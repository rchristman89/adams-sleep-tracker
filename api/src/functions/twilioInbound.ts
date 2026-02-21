import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";

import { getSleepEntriesClient, getSmsEventsClient, getTableStorageConfigFromEnv, upsertSleepEntry, insertSmsEvent } from "../storage";
import { addDays, isoDateInTimeZone } from "../shared/dates";
import { parseSleep } from "../shared/parseSleep";
import { verifyTwilioSignature } from "../twilio/verifyTwilio";

function twimlMessage(message: string, status = 200): HttpResponseInit {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
  return {
    status,
    headers: {
      "content-type": "text/xml"
    },
    body: xml
  };
}

function escapeXml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function readForm(req: HttpRequest): Promise<Record<string, string>> {
  // Twilio sends application/x-www-form-urlencoded.
  const text = await req.text();
  const params = new URLSearchParams(text);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

export async function twilioInbound(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const env = process.env;
  const tz = env.TIMEZONE ?? "America/New_York";
  const authToken = env.TWILIO_AUTH_TOKEN;
  const expectedTo = env.ADAM_TO_NUMBER;
  const storageCs = env.AZURE_STORAGE_CONNECTION_STRING;
  const webhookUrlOverride = env.TWILIO_WEBHOOK_URL;

  if (!authToken || !expectedTo || !storageCs) {
    ctx.error("Twilio inbound misconfigured: missing required environment variables", {
      hasAuthToken: !!authToken,
      hasExpectedTo: !!expectedTo,
      hasStorageConnectionString: !!storageCs
    });
    return { status: 500, body: "Internal Server Error" };
  }

  const form = await readForm(req);
  const body = form.Body ?? "";
  const from = form.From ?? "";
  const to = form.To ?? "";
  const messageSid = form.MessageSid ?? "";

  const signature = req.headers.get("x-twilio-signature") ?? undefined;
  const sig = verifyTwilioSignature({
    twilioAuthToken: authToken,
    signatureHeader: signature,
    url: req.url,
    overrideUrl: webhookUrlOverride,
    params: form
  });

  if (!sig.ok) {
    ctx.warn("Twilio signature validation failed", { from, to, messageSid, urlUsed: sig.urlUsed });
    return { status: 403, body: "Forbidden" };
  }

  const normalizedTo = to.trim();
  const normalizedExpectedTo = expectedTo.trim();

  if (!normalizedTo || normalizedTo !== normalizedExpectedTo) {
    // Not our number.
    return { status: 403, body: "Forbidden" };
  }

  const receivedAt = new Date();
  const receivedAtUtc = receivedAt.toISOString();
  const receivedAtLocalDate = isoDateInTimeZone(receivedAt, tz);
  // Map reply day D (local) -> sleep "night" date D-1 (no exceptions).
  // This is intentional: any reply received on day D is considered reporting the
  // previous night's sleep.
  const sleepDate = addDays(receivedAtLocalDate, -1);

  const parsed = parseSleep(body);

  let sleepClient;
  let smsClient;
  try {
    const cfg = getTableStorageConfigFromEnv(env);
    sleepClient = getSleepEntriesClient(cfg);
    smsClient = getSmsEventsClient(cfg);
  } catch (err) {
    ctx.error("Failed to initialize Table Storage clients", { err });
    return twimlMessage("Internal error logging sleep. Try again.");
  }

  if (!parsed.ok) {
    try {
      await insertSmsEvent(smsClient, {
        messageSid,
        direction: "inbound",
        body,
        fromNumber: from,
        toNumber: to,
        timestampUtc: receivedAtUtc,
        parseStatus: "error",
        parseError: parsed.error
      });
    } catch (err) {
      // Still respond with help text even if audit logging fails.
      ctx.error("Failed to insert inbound SmsEvent (parse error)", { err, messageSid });
    }

    return twimlMessage(`Could not parse. Reply like 7.5, 7h 30m, or 7:30. (${parsed.error})`);
  }

  try {
    await upsertSleepEntry(sleepClient, {
      sleepDate,
      minutesSlept: parsed.minutes,
      rawReply: body,
      receivedAtUtc,
      receivedAtLocalDate,
      fromNumber: from,
      messageSid,
      updatedAtUtc: receivedAtUtc
    });

    await insertSmsEvent(smsClient, {
      messageSid,
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
    ctx.error("Failed to persist inbound sleep entry", { err, messageSid, sleepDate });
    return twimlMessage("Internal error logging sleep. Try again.");
  }

  const hours = parseFloat((parsed.minutes / 60).toFixed(2));
  return twimlMessage(`Logged ${hours}h for ${sleepDate}.`);
}

app.http("twilioInbound", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "twilio/inbound",
  handler: twilioInbound
});
