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

  if (!authToken) return { status: 500, body: "TWILIO_AUTH_TOKEN missing" };
  if (!expectedTo) return { status: 500, body: "ADAM_TO_NUMBER missing" };

  const form = await readForm(req);
  const body = form.Body ?? "";
  const from = form.From ?? "";
  const to = form.To ?? "";
  const messageSid = form.MessageSid ?? "";

  if (!to || to !== expectedTo) {
    // Not our number / misconfiguration.
    return { status: 403, body: "Forbidden" };
  }

  const signature = req.headers.get("x-twilio-signature") ?? undefined;
  const okSig = verifyTwilioSignature({
    twilioAuthToken: authToken,
    signatureHeader: signature,
    url: req.url,
    params: form
  });

  if (!okSig) {
    ctx.warn("Twilio signature validation failed", { from, to, messageSid });
    return { status: 403, body: "Forbidden" };
  }

  const receivedAt = new Date();
  const receivedAtUtc = receivedAt.toISOString();
  const receivedAtLocalDate = isoDateInTimeZone(receivedAt, tz);
  const sleepDate = addDays(receivedAtLocalDate, -1);

  const parsed = parseSleep(body);

  const cfg = getTableStorageConfigFromEnv(env);
  const sleepClient = getSleepEntriesClient(cfg);
  const smsClient = getSmsEventsClient(cfg);

  if (!parsed.ok) {
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

    return twimlMessage(
      `Could not parse. Reply like 7.5, 7h 30m, or 7:30. (${parsed.error})`
    );
  }

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

  const hours = (parsed.minutes / 60).toFixed(2).replace(/\.00$/, "");
  return twimlMessage(`Logged ${hours}h for ${sleepDate}.`);
}

app.http("twilioInbound", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "twilio/inbound",
  handler: twilioInbound
});
