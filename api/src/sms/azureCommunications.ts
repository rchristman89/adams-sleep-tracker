import { Buffer } from "node:buffer";
import { createHash, createHmac } from "node:crypto";

import type { SendSmsResult } from "../twilio/sendSms.js";

/**
 * Parse an Azure Communication Services connection string.
 *
 * Format: endpoint=https://<resource>.communication.azure.com/;accesskey=<base64>
 */
function parseAcsConnectionString(cs: string): { endpoint: string; accessKey: string } | null {
  const parts: Record<string, string> = {};
  for (const segment of cs.split(";")) {
    const idx = segment.indexOf("=");
    if (idx < 1) continue;
    parts[segment.slice(0, idx).toLowerCase()] = segment.slice(idx + 1);
  }
  const endpoint = parts["endpoint"];
  const accessKey = parts["accesskey"];
  if (!endpoint || !accessKey) return null;
  return { endpoint: endpoint.replace(/\/$/, ""), accessKey };
}

function sha256Base64(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("base64");
}

function hmacSHA256Base64(keyBase64: string, message: string): string {
  const keyBytes = Buffer.from(keyBase64, "base64");
  return createHmac("sha256", keyBytes).update(message, "utf8").digest("base64");
}

/**
 * Send an SMS using Azure Communication Services REST API.
 *
 * Required env vars (caller provides parsed values):
 *   ACS_CONNECTION_STRING — e.g. "endpoint=https://...;accesskey=..."
 *   ACS_FROM_NUMBER       — phone number in E.164 format
 *   ADAM_TO_NUMBER        — recipient phone number in E.164 format
 */
export async function sendSmsViaAzureCommunication(params: {
  connectionString: string;
  from: string;
  to: string;
  body: string;
}): Promise<SendSmsResult> {
  const { from, to, body } = params;

  const parsed = parseAcsConnectionString(params.connectionString);
  if (!parsed) {
    return { ok: false, error: "Invalid ACS connection string: missing endpoint or accesskey" };
  }
  const { endpoint, accessKey } = parsed;

  const url = `${endpoint}/sms?api-version=2021-03-07`;
  const payload = JSON.stringify({
    from,
    smsRecipients: [{ to }],
    message: body
  });

  const date = new Date().toUTCString();
  const contentHash = sha256Base64(payload);
  const urlObj = new URL(url);
  const stringToSign = `POST\n${urlObj.pathname}${urlObj.search}\n${date};${urlObj.host};${contentHash}`;
  const signature = hmacSHA256Base64(accessKey, stringToSign);
  const authHeader = `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ms-date": date,
        "host": urlObj.host,
        "x-ms-content-sha256": contentHash,
        "Authorization": authHeader
      },
      body: payload
    });
  } catch (err) {
    return { ok: false, error: "Failed to reach Azure Communication Services", details: err };
  }

  let json: unknown = null;
  try {
    json = await resp.json();
  } catch {
    // ignore parse errors
  }

  if (!resp.ok) {
    return { ok: false, error: "ACS send failed", status: resp.status, details: json };
  }

  // ACS returns: { "value": [{ "to": "...", "messageId": "...", "httpStatusCode": 202, ... }] }
  const value = (json as any)?.value;
  const messageId: string = Array.isArray(value) ? (value[0]?.messageId ?? "") : "";
  if (!messageId) {
    return { ok: false, error: "ACS response missing messageId", details: json };
  }

  return { ok: true, messageSid: messageId };
}
