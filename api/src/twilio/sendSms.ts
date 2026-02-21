import { Buffer } from "node:buffer";

export type SendSmsResult =
  | { ok: true; messageSid: string }
  | { ok: false; error: string; status?: number; details?: unknown };

export async function sendSms(params: {
  accountSid: string;
  authToken: string;
  from: string;
  to: string;
  body: string;
}): Promise<SendSmsResult> {
  const { accountSid, authToken, from, to, body } = params;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;

  const form = new URLSearchParams();
  form.set("From", from);
  form.set("To", to);
  form.set("Body", body);

  const basic = Buffer.from(`${accountSid}:${authToken}`, "utf8").toString("base64");

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "content-type": "application/x-www-form-urlencoded"
      },
      body: form.toString()
    });
  } catch (err) {
    return { ok: false, error: "Failed to reach Twilio", details: err };
  }

  let bodyText: string | undefined;
  try {
    bodyText = await resp.text();
  } catch {
    bodyText = undefined;
  }

  let json: any = null;
  if (bodyText !== undefined) {
    try {
      json = JSON.parse(bodyText);
    } catch {
      // ignore parse errors; we'll fall back to raw text
    }
  }

  if (!resp.ok) {
    return {
      ok: false,
      error: "Twilio send failed",
      status: resp.status,
      details: json ?? bodyText
    };
  }

  const sid = String(json?.sid ?? "");
  if (!sid) return { ok: false, error: "Twilio response missing sid", details: json ?? bodyText };

  return { ok: true, messageSid: sid };
}
