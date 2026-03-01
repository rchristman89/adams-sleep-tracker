import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from "@azure/functions";

import { getSmsEventsClient, getTableStorageConfigFromEnv, insertSmsEvent } from "../storage/index.js";
import { sendSms, getSmsProvider } from "../sms/sendSms.js";
import { json, requireJobSecret } from "./jobsShared.js";

export async function jobsSendPrompt(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const auth = await requireJobSecret(req, ctx);
  if (!auth.ok) return auth.resp;

  const env = process.env;
  const provider = getSmsProvider(env);
  const to = env.ADAM_TO_NUMBER;

  if (!to) {
    ctx.error("sendPrompt misconfigured: missing required environment variables", {
      hasTo: !!to
    });
    return json(500, { error: "Internal Server Error" });
  }

  const storageCs = env.AZURE_STORAGE_CONNECTION_STRING;
  const messageBody = "Morning — how many hours did you sleep last night? Reply like 7.5 or 7:30.";
  const sentAtUtc = new Date().toISOString();

  const sent = await sendSms({ provider, env, to, body: messageBody });
  if (!sent.ok) {
    ctx.error("sendPrompt failed", { provider, error: sent.error, status: sent.status, details: sent.details });
    return json(502, { error: "Bad Gateway" });
  }

  const fromNumber =
    provider === "azure-communication"
      ? (env.ACS_FROM_NUMBER ?? "")
      : provider === "infobip"
        ? (env.INFOBIP_FROM ?? "")
        : (env.TWILIO_FROM_NUMBER ?? "");

  // Best-effort audit logging.
  if (storageCs) {
    try {
      const cfg = getTableStorageConfigFromEnv(env);
      const smsClient = getSmsEventsClient(cfg);
      await insertSmsEvent(smsClient, {
        messageSid: sent.messageSid,
        direction: "outbound",
        body: messageBody,
        fromNumber,
        toNumber: to,
        timestampUtc: sentAtUtc
      });
    } catch (err) {
      ctx.error("Failed to insert outbound SmsEvent (prompt)", { err, messageSid: sent.messageSid });
    }
  }

  return json(200, { ok: true, messageSid: sent.messageSid });
}

app.http("jobsSendPrompt", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "jobs/sendPrompt",
  handler: jobsSendPrompt
});
