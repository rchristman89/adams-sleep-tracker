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

  let json: any = null;
  try {
    json = await resp.json();
  } catch {
    // ignore
  }

  if (!resp.ok) {
    return {
      ok: false,
      error: "Twilio send failed",
      status: resp.status,
      details: json ?? (await resp.text().catch(() => undefined))
    };
  }

  const sid = String(json?.sid ?? "");
  if (!sid) return { ok: false, error: "Twilio response missing sid", details: json };

  return { ok: true, messageSid: sid };
}
