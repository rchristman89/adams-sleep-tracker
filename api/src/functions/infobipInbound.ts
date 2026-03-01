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
 * Infobip inbound SMS webhook.
 *
 * Infobip POSTs JSON to this endpoint when an inbound SMS arrives.
 * Configure the URL in the Infobip portal under:
 *   Channels → SMS → your number → Forwarding → HTTP Forwarding
 *
 * Required env vars:
 *   AZURE_STORAGE_CONNECTION_STRING
 *   ADAM_TO_NUMBER          — expected destination number (E.164)
 *   ADAM_FROM_NUMBER        — (optional) restrict accepted sender
 *   TIMEZONE                — defaults to America/New_York
 *   SMS_PROVIDER            — set to "infobip" for reply SMS
 *   INFOBIP_BASE_URL        — needed for reply SMS
 *   INFOBIP_API_KEY         — needed for reply SMS
 *   INFOBIP_FROM            — sender for reply SMS
 *   INFOBIP_WEBHOOK_SECRET  — (optional) shared secret for basic verification
 */
export async function infobipInbound(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const env = process.env;

  const storageCs = env.AZURE_STORAGE_CONNECTION_STRING;
  const expectedTo = env.ADAM_TO_NUMBER;
  const expectedFrom = env.ADAM_FROM_NUMBER;
  const tz = env.TIMEZONE ?? "America/New_York";

  if (!storageCs || !expectedTo) {
    ctx.error("Infobip inbound misconfigured: missing required environment variables", {
      hasStorageConnectionString: !!storageCs,
      hasExpectedTo: !!expectedTo
    });
    return { status: 500, body: "Internal Server Error" };
  }

  // Optional shared-secret verification via query param or header.
  const webhookSecret = env.INFOBIP_WEBHOOK_SECRET;
  if (webhookSecret) {
    const provided =
      req.query.get("secret") ?? req.headers.get("x-infobip-webhook-secret") ?? "";
    if (provided !== webhookSecret) {
      ctx.warn("Infobip inbound: webhook secret mismatch");
      return { status: 403, body: "Forbidden" };
    }
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return { status: 400, body: "Bad Request" };
  }

  // Infobip payload: { results: [{ messageId, from, to, text, receivedAt, ... }], messageCount, pendingMessageCount }
  const results: any[] = (rawBody as any)?.results ?? [];

  if (results.length === 0) {
    return json(200, { ok: true });
  }

  let sleepClient;
  let smsClient;
  try {
    const cfg = getTableStorageConfigFromEnv(env);
    sleepClient = getSleepEntriesClient(cfg);
    smsClient = getSmsEventsClient(cfg);
  } catch (err) {
    ctx.error("Infobip inbound: Failed to initialize Table Storage clients", { err });
    return { status: 500, body: "Internal Server Error" };
  }

  for (const msg of results) {
    const from: string = (msg?.from ?? "").trim();
    const to: string = (msg?.to ?? "").trim();
    const body: string = msg?.text ?? msg?.cleanText ?? "";
    const messageId: string = msg?.messageId ?? "";

    if (!from || !to) {
      ctx.warn("Infobip inbound: missing from or to in message", { messageId });
      continue;
    }

    if (to !== expectedTo.trim()) {
      ctx.warn("Infobip inbound: unexpected to number", { to, expected: expectedTo });
      continue;
    }

    if (expectedFrom?.trim() && from !== expectedFrom.trim()) {
      ctx.warn("Infobip inbound: unexpected from number", { from });
      continue;
    }

    ctx.info("Infobip inbound received", { messageId, from, to, bodyLength: body.length });

    const receivedAt = new Date();
    const receivedAtUtc = receivedAt.toISOString();
    const receivedAtLocalDate = isoDateInTimeZone(receivedAt, tz);
    const sleepDate = addDays(receivedAtLocalDate, -1);

    const parsed = parseSleep(body);

    if (!parsed.ok) {
      ctx.warn("Infobip inbound parse failed", { messageId, from, error: parsed.error });

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
        ctx.error("Infobip inbound: Failed to insert SmsEvent (parse error)", { err, messageId });
      }

      await sendReply(env, to, from, `Could not parse. Reply like 7.5, 7h 30m, or 7:30. (${parsed.error})`, ctx);
      continue;
    }

    ctx.info("Infobip inbound parsed", { messageId, sleepDate, minutesSlept: parsed.minutes });

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
      ctx.error("Infobip inbound: Failed to upsert SleepEntry", { err, messageId, sleepDate });
      await sendReply(env, to, from, "Internal error logging sleep. Try again.", ctx);
      continue;
    }

    ctx.info("Infobip inbound upserted", { messageId, sleepDate, minutesSlept: parsed.minutes });

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
      ctx.error("Infobip inbound: Failed to insert SmsEvent (success)", { err, messageId, sleepDate });
    }

    const hours = parseFloat((parsed.minutes / 60).toFixed(2));
    await sendReply(env, to, from, `Logged ${hours}h for ${sleepDate}.`, ctx);
  }

  return json(200, { ok: true });
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
    ctx.warn("Infobip inbound: reply SMS failed", {
      provider,
      error: result.error,
      status: result.status
    });
  }
}

app.http("infobipInbound", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "infobip/inbound",
  handler: infobipInbound
});
