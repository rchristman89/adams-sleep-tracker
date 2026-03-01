import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";

import {
  getSleepEntriesClient,
  getSmsEventsClient,
  getTableStorageConfigFromEnv,
  upsertSleepEntry,
  insertSmsEvent
} from "../storage/index.js";
import { addDays, isoDateInTimeZone } from "../shared/dates.js";
import { parseSleep } from "../shared/parseSleep.js";
import { sendSms, getSmsProvider } from "../sms/sendSms.js";
import { json } from "./jobsShared.js";

/**
 * Azure Communication Services inbound SMS webhook.
 *
 * ACS publishes inbound SMS events via Azure Event Grid (CloudEvents schema).
 * This handler:
 *   1. Responds to Event Grid subscription validation requests.
 *   2. Processes `Microsoft.Communication.SMSReceived` events.
 *
 * Required env vars:
 *   AZURE_STORAGE_CONNECTION_STRING
 *   ADAM_TO_NUMBER          — expected destination number (E.164)
 *   ADAM_FROM_NUMBER        — (optional) restrict accepted sender
 *   TIMEZONE                — defaults to America/New_York
 *   SMS_PROVIDER            — set to "azure-communication" or "infobip" for reply SMS
 *   ACS_CONNECTION_STRING   — needed when SMS_PROVIDER=azure-communication
 *   ACS_FROM_NUMBER         — needed when SMS_PROVIDER=azure-communication
 *   INFOBIP_BASE_URL        — needed when SMS_PROVIDER=infobip
 *   INFOBIP_API_KEY         — needed when SMS_PROVIDER=infobip
 *   INFOBIP_FROM            — needed when SMS_PROVIDER=infobip
 */
export async function acsInbound(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const env = process.env;

  // Validate Event Grid webhook (subscription handshake).
  // https://docs.microsoft.com/en-us/azure/event-grid/webhook-event-delivery
  const aegValidationCode = req.headers.get("aeg-event-type");
  if (aegValidationCode === "SubscriptionValidation") {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return { status: 400, body: "Bad Request" };
    }

    const events = Array.isArray(body) ? body : [body];
    const validationEvent = events.find(
      (e: any) =>
        e?.eventType === "Microsoft.EventGrid.SubscriptionValidationEvent" ||
        e?.type === "Microsoft.EventGrid.SubscriptionValidationEvent"
    );
    if (validationEvent) {
      const validationCode =
        validationEvent?.data?.validationCode ?? validationEvent?.data?.ValidationCode;
      if (validationCode) {
        ctx.info("ACS inbound: Event Grid subscription validation", { validationCode });
        return json(200, { validationResponse: validationCode });
      }
    }
    return { status: 400, body: "Bad Request" };
  }

  const storageCs = env.AZURE_STORAGE_CONNECTION_STRING;
  const expectedTo = env.ADAM_TO_NUMBER;
  const expectedFrom = env.ADAM_FROM_NUMBER;
  const tz = env.TIMEZONE ?? "America/New_York";

  if (!storageCs || !expectedTo) {
    ctx.error("ACS inbound misconfigured: missing required environment variables", {
      hasStorageConnectionString: !!storageCs,
      hasExpectedTo: !!expectedTo
    });
    return { status: 500, body: "Internal Server Error" };
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return { status: 400, body: "Bad Request" };
  }

  // ACS sends an array of CloudEvents
  const events = Array.isArray(rawBody) ? rawBody : [rawBody];
  const smsEvents = events.filter(
    (e: any) =>
      e?.type === "Microsoft.Communication.SMSReceived" ||
      e?.eventType === "Microsoft.Communication.SMSReceived"
  );

  if (smsEvents.length === 0) {
    // Acknowledge unknown event types without error
    return { status: 200, body: "" };
  }

  let sleepClient;
  let smsClient;
  try {
    const cfg = getTableStorageConfigFromEnv(env);
    sleepClient = getSleepEntriesClient(cfg);
    smsClient = getSmsEventsClient(cfg);
  } catch (err) {
    ctx.error("ACS inbound: Failed to initialize Table Storage clients", { err });
    return { status: 500, body: "Internal Server Error" };
  }

  for (const event of smsEvents) {
    const data = event?.data ?? {};
    const from: string = (data.From ?? data.from ?? "").trim();
    const to: string = (data.To ?? data.to ?? "").trim();
    const body: string = data.Message ?? data.message ?? data.text ?? "";
    const messageId: string = data.MessageId ?? data.messageId ?? event?.id ?? "";

    if (!from || !to) {
      ctx.warn("ACS inbound: missing From or To in event data", { eventId: event?.id });
      continue;
    }

    if (to !== expectedTo.trim()) {
      ctx.warn("ACS inbound: unexpected To number", { to, expected: expectedTo });
      continue;
    }

    if (expectedFrom?.trim() && from !== expectedFrom.trim()) {
      ctx.warn("ACS inbound: unexpected From number", { from });
      continue;
    }

    ctx.info("ACS inbound received", { messageId, from, to, bodyLength: body.length });

    const receivedAt = new Date();
    const receivedAtUtc = receivedAt.toISOString();
    const receivedAtLocalDate = isoDateInTimeZone(receivedAt, tz);
    const sleepDate = addDays(receivedAtLocalDate, -1);

    const parsed = parseSleep(body);

    if (!parsed.ok) {
      ctx.warn("ACS inbound parse failed", { messageId, from, error: parsed.error });

      try {
        await insertSmsEvent(smsClient, {
          messageSid: messageId,
          direction: "inbound",
          body,
          fromNumber: from,
          toNumber: to,
          timestampUtc: receivedAtUtc,
          parseStatus: "error",
          parseError: parsed.error
        });
      } catch (err) {
        ctx.error("ACS inbound: Failed to insert SmsEvent (parse error)", { err, messageId });
      }

      await sendReply(env, to, from, `Could not parse. Reply like 7.5, 7h 30m, or 7:30. (${parsed.error})`, ctx);
      continue;
    }

    ctx.info("ACS inbound parsed", { messageId, sleepDate, minutesSlept: parsed.minutes });

    try {
      await upsertSleepEntry(sleepClient, {
        sleepDate,
        minutesSlept: parsed.minutes,
        rawReply: body,
        receivedAtUtc,
        receivedAtLocalDate,
        fromNumber: from,
        messageSid: messageId,
        updatedAtUtc: receivedAtUtc
      });
    } catch (err) {
      ctx.error("ACS inbound: Failed to upsert SleepEntry", { err, messageId, sleepDate });
      await sendReply(env, to, from, "Internal error logging sleep. Try again.", ctx);
      continue;
    }

    ctx.info("ACS inbound upserted", { messageId, sleepDate, minutesSlept: parsed.minutes });

    try {
      await insertSmsEvent(smsClient, {
        messageSid: messageId,
        direction: "inbound",
        body,
        fromNumber: from,
        toNumber: to,
        timestampUtc: receivedAtUtc,
        parsedMinutes: parsed.minutes,
        parseStatus: "ok",
        relatedSleepDate: sleepDate
      });
    } catch (err) {
      ctx.error("ACS inbound: Failed to insert SmsEvent (success)", { err, messageId, sleepDate });
    }

    const hours = parseFloat((parsed.minutes / 60).toFixed(2));
    await sendReply(env, to, from, `Logged ${hours}h for ${sleepDate}.`, ctx);
  }

  return { status: 200, body: "" };
}

async function sendReply(
  env: NodeJS.ProcessEnv,
  from: string,
  to: string,
  message: string,
  ctx: InvocationContext
): Promise<void> {
  const provider = getSmsProvider(env);
  const result = await sendSms({ provider, env, to, body: message });
  if (!result.ok) {
    ctx.warn("ACS inbound: reply SMS failed", {
      provider,
      error: result.error,
      status: result.status
    });
  }
}

app.http("acsInbound", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "acs/inbound",
  handler: acsInbound
});
