export type ParseSleepResult =
  | { ok: true; minutes: number }
  | { ok: false; error: string };

/**
 * Parses common sleep-duration formats.
 * Supported examples:
 * - "7.5" (hours as decimal)
 * - "7" (hours)
 * - "7h 30m"
 * - "7:30" (H:MM)
 */
export function parseSleep(text: string): ParseSleepResult {
  const raw = (text ?? "").trim().toLowerCase();
  if (!raw) return { ok: false, error: "Empty reply" };

  // H:MM
  const hm = raw.match(/^(\d{1,2})\s*:\s*(\d{2})$/);
  if (hm) {
    const h = Number(hm[1]);
    const m = Number(hm[2]);
    if (!Number.isFinite(h) || !Number.isFinite(m) || m >= 60) {
      return { ok: false, error: "Invalid time format" };
    }
    return { ok: true, minutes: h * 60 + m };
  }

  // "7h 30m" / "7h" / "30m"
  const hPart = raw.match(/(\d{1,2})\s*h/);
  const mPart = raw.match(/(\d{1,2})\s*m/);
  if (hPart || mPart) {
    const h = hPart ? Number(hPart[1]) : 0;
    const m = mPart ? Number(mPart[1]) : 0;
    if (!Number.isFinite(h) || !Number.isFinite(m) || m >= 60) {
      return { ok: false, error: "Invalid h/m format" };
    }
    return { ok: true, minutes: h * 60 + m };
  }

  // Decimal hours (7.5) or integer hours (7)
  const hours = Number(raw);
  if (Number.isFinite(hours)) {
    if (hours < 0) return { ok: false, error: "Negative hours not allowed" };
    return { ok: true, minutes: Math.round(hours * 60) };
  }

  return {
    ok: false,
    error: 'Unrecognized format. Try "7.5", "7h 30m", or "7:30".'
  };
}
