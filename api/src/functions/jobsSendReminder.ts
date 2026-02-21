import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";

import {
  getSleepEntriesClient,
  getSmsEventsClient,
  getTableStorageConfigFromEnv,
  hasReplyOnLocalDate,
  insertSmsEvent
} from "../storage";
import { isoDateInTimeZone } from "../shared/dates";
import { sendSms } from "../twilio/sendSms";
import { json, requireJobSecret } from "./jobsShared";

export async function jobsSendReminder(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const auth = await requireJobSecret(req, ctx);
  if (!auth.ok) return auth.resp;

  const env = process.env;
  const tz = env.TIMEZONE ?? "America/New_York";

  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_FROM_NUMBER;
  const to = env.ADAM_TO_NUMBER;

  const storageCs = env.AZURE_STORAGE_CONNECTION_STRING;
  if (!accountSid || !authToken || !from || !to || !storageCs) {
    ctx.error("sendReminder misconfigured: missing required environment variables", {
      hasAccountSid: !!accountSid,
      hasAuthToken: !!authToken,
      hasFrom: !!from,
      hasTo: !!to,
      hasStorageConnectionString: !!storageCs
    });
    return json(500, { error: "Internal Server Error" });
  }

  let sleepClient;
  let smsClient;
  try {
    const cfg = getTableStorageConfigFromEnv(env);
    sleepClient = getSleepEntriesClient(cfg);
    smsClient = getSmsEventsClient(cfg);
  } catch (err) {
    ctx.error("Failed to initialize Table Storage clients", { err });
    return json(500, { error: "Internal Server Error" });
  }

  const now = new Date();
  const localDate = isoDateInTimeZone(now, tz);

  let hasReply: boolean;
  try {
    hasReply = await hasReplyOnLocalDate(sleepClient, localDate);
  } catch (err) {
    ctx.error("Failed to query Table Storage for reply on local date", { err, localDate });
    return json(500, { error: "Internal Server Error" });
  }

  if (hasReply) {
    return json(200, { ok: true, skipped: true, reason: "Already have reply for today", localDate });
  }

  const messageBody = "Reminder: please reply with how many hours you slept last night (e.g. 7.5 or 7:30).";
  const sentAtUtc = now.toISOString();

  const sent = await sendSms({ accountSid, authToken, from, to, body: messageBody });
  if (!sent.ok) {
    ctx.error("Twilio sendReminder failed", { status: sent.status, details: sent.details });
    return json(502, { error: "Bad Gateway" });
  }

  // Best-effort audit logging.
  try {
    await insertSmsEvent(smsClient, {
      messageSid: sent.messageSid,
      direction: "outbound",
      body: messageBody,
      fromNumber: from,
      toNumber: to,
      timestampUtc: sentAtUtc
    });
  } catch (err) {
    ctx.error("Failed to insert outbound SmsEvent (reminder)", { err, messageSid: sent.messageSid });
  }

  return json(200, { ok: true, messageSid: sent.messageSid, localDate });
}

app.http("jobsSendReminder", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "jobs/sendReminder",
  handler: jobsSendReminder
});
