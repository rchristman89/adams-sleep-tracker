import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";

import { getSmsEventsClient, getTableStorageConfigFromEnv, insertSmsEvent } from "../storage";
import { sendSms } from "../twilio/sendSms";
import { json, requireJobSecret } from "./jobsShared";

export async function jobsSendPrompt(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const auth = requireJobSecret(req, ctx);
  if (!auth.ok) return auth.resp;

  const env = process.env;
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_FROM_NUMBER;
  const to = env.ADAM_TO_NUMBER;

  const storageCs = env.AZURE_STORAGE_CONNECTION_STRING;
  if (!accountSid || !authToken || !from || !to || !storageCs) {
    ctx.error("sendPrompt misconfigured: missing required environment variables", {
      hasAccountSid: !!accountSid,
      hasAuthToken: !!authToken,
      hasFrom: !!from,
      hasTo: !!to,
      hasStorageConnectionString: !!storageCs
    });
    return json(500, { error: "Internal Server Error" });
  }

  const messageBody = "Morning — how many hours did you sleep last night? Reply like 7.5 or 7:30.";
  const sentAtUtc = new Date().toISOString();

  const sent = await sendSms({ accountSid, authToken, from, to, body: messageBody });
  if (!sent.ok) {
    ctx.error("Twilio sendPrompt failed", { status: sent.status, details: sent.details });
    return json(502, { error: "Bad Gateway" });
  }

  // Best-effort audit logging.
  try {
    const cfg = getTableStorageConfigFromEnv(env);
    const smsClient = getSmsEventsClient(cfg);
    await insertSmsEvent(smsClient, {
      messageSid: sent.messageSid,
      direction: "outbound",
      body: messageBody,
      fromNumber: from,
      toNumber: to,
      timestampUtc: sentAtUtc
    });
  } catch (err) {
    ctx.error("Failed to insert outbound SmsEvent (prompt)", { err, messageSid: sent.messageSid });
  }

  return json(200, { ok: true, messageSid: sent.messageSid });
}

app.http("jobsSendPrompt", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "jobs/sendPrompt",
  handler: jobsSendPrompt
});
