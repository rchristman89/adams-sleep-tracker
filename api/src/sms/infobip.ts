import type { SendSmsResult } from "../twilio/sendSms.js";

/**
 * Send an SMS using the Infobip SMS API (v2 advanced text endpoint).
 *
 * Required env vars (caller provides parsed values):
 *   INFOBIP_BASE_URL  — e.g. "xxxxx.api.infobip.com" (no protocol)
 *   INFOBIP_API_KEY   — API key from Infobip portal
 *   INFOBIP_FROM      — sender ID or phone number
 *   ADAM_TO_NUMBER    — recipient phone number in E.164 format
 *
 * Docs: https://www.infobip.com/docs/api/channels/sms/sms-messaging/outbound-sms/send-sms-message
 */
export async function sendSmsViaInfobip(params: {
  baseUrl: string;
  apiKey: string;
  from: string;
  to: string;
  body: string;
}): Promise<SendSmsResult> {
  const { baseUrl, apiKey, from, to, body } = params;

  // Normalise: strip protocol if caller included it
  const host = baseUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const url = `https://${host}/sms/2/text/advanced`;

  const payload = JSON.stringify({
    messages: [
      {
        from,
        destinations: [{ to }],
        text: body
      }
    ]
  });

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `App ${apiKey}`
      },
      body: payload
    });
  } catch (err) {
    return { ok: false, error: "Failed to reach Infobip", details: err };
  }

  let json: unknown = null;
  try {
    json = await resp.json();
  } catch {
    // ignore parse errors
  }

  if (!resp.ok) {
    return { ok: false, error: "Infobip send failed", status: resp.status, details: json };
  }

  // Infobip returns: { "messages": [{ "messageId": "...", "status": { ... }, "to": "..." }] }
  const messages = (json as any)?.messages;
  const messageId: string = Array.isArray(messages) ? (messages[0]?.messageId ?? "") : "";
  if (!messageId) {
    return { ok: false, error: "Infobip response missing messageId", details: json };
  }

  return { ok: true, messageSid: messageId };
}
