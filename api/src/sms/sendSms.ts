import type { SendSmsResult } from "../twilio/sendSms.js";
import { sendSms as sendSmsViaTwilio } from "../twilio/sendSms.js";
import { sendSmsViaAzureCommunication } from "./azureCommunications.js";
import { sendSmsViaInfobip } from "./infobip.js";

export type { SendSmsResult };

/**
 * The SMS provider to use for outbound messages.
 *
 * Set via `SMS_PROVIDER` environment variable:
 *   - "twilio"                (default) — use Twilio
 *   - "azure-communication"  — use Azure Communication Services
 *   - "infobip"              — use Infobip directly
 */
export type SmsProvider = "twilio" | "azure-communication" | "infobip";

export function getSmsProvider(env: NodeJS.ProcessEnv): SmsProvider {
  const raw = env.SMS_PROVIDER?.trim().toLowerCase();
  if (raw === "azure-communication" || raw === "infobip") return raw;
  return "twilio";
}

/**
 * Send an SMS using the configured provider (SMS_PROVIDER env var).
 *
 * Twilio:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 *
 * Azure Communication Services:
 *   ACS_CONNECTION_STRING, ACS_FROM_NUMBER
 *
 * Infobip:
 *   INFOBIP_BASE_URL, INFOBIP_API_KEY, INFOBIP_FROM
 *
 * All providers require:
 *   ADAM_TO_NUMBER (recipient)
 */
export async function sendSms(params: {
  provider: SmsProvider;
  env: NodeJS.ProcessEnv;
  to: string;
  body: string;
}): Promise<SendSmsResult> {
  const { provider, env, to, body } = params;

  if (provider === "azure-communication") {
    const connectionString = env.ACS_CONNECTION_STRING;
    const from = env.ACS_FROM_NUMBER;
    if (!connectionString || !from) {
      return {
        ok: false,
        error: "ACS misconfigured: missing ACS_CONNECTION_STRING or ACS_FROM_NUMBER"
      };
    }
    return sendSmsViaAzureCommunication({ connectionString, from, to, body });
  }

  if (provider === "infobip") {
    const baseUrl = env.INFOBIP_BASE_URL;
    const apiKey = env.INFOBIP_API_KEY;
    const from = env.INFOBIP_FROM;
    if (!baseUrl || !apiKey || !from) {
      return {
        ok: false,
        error: "Infobip misconfigured: missing INFOBIP_BASE_URL, INFOBIP_API_KEY, or INFOBIP_FROM"
      };
    }
    return sendSmsViaInfobip({ baseUrl, apiKey, from, to, body });
  }

  // Default: Twilio
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_FROM_NUMBER;
  if (!accountSid || !authToken || !from) {
    return {
      ok: false,
      error: "Twilio misconfigured: missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_FROM_NUMBER"
    };
  }
  return sendSmsViaTwilio({ accountSid, authToken, from, to, body });
}
