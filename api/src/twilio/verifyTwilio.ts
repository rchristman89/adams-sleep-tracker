import { validateRequest } from "twilio";

/**
 * Verify Twilio webhook signature.
 *
 * NOTE: `url` must be the exact URL Twilio requested (scheme/host/path/query).
 * Azure Functions' `req.url` is generally correct when the Function App is behind
 * a stable public hostname.
 */
export function verifyTwilioSignature(opts: {
  twilioAuthToken: string;
  signatureHeader: string | undefined;
  url: string;
  params: Record<string, string>;
}): boolean {
  const { twilioAuthToken, signatureHeader, url, params } = opts;
  if (!signatureHeader) return false;

  return validateRequest(twilioAuthToken, signatureHeader, url, params);
}
