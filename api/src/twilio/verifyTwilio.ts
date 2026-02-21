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
  /**
   * The URL Twilio requested.
   *
   * Warning: proxies / custom domains can cause req.url to differ from the
   * public-facing URL.
   */
  url: string;
  /** Optional override when req.url is not the public-facing URL. */
  overrideUrl?: string;
  params: Record<string, string>;
}): { ok: boolean; urlUsed: string } {
  const { twilioAuthToken, signatureHeader, url, overrideUrl, params } = opts;
  const urlUsed = overrideUrl?.trim() || url;

  if (!signatureHeader) return { ok: false, urlUsed };

  return {
    ok: validateRequest(twilioAuthToken, signatureHeader, urlUsed, params),
    urlUsed
  };
}
