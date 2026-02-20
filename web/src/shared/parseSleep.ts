export type ParseSleepOk = {
  ok: true;
  minutes: number;
  normalized: string; // e.g. "7h 30m"
  method: "clock" | "tokens" | "decimal" | "integer";
};

export type ParseSleepErr = {
  ok: false;
  error: string;
};

export type ParseSleepResult = ParseSleepOk | ParseSleepErr;

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${pad2(m)}m`;
}

/**
 * Parse sleep duration from SMS.
 * Supported formats:
 *  - "7.5" (decimal hours)
 *  - "7" (hours)
 *  - "7h 30m" (tokens)
 *  - "7:30" (clock)
 */
export function parseSleep(input: string, opts?: { maxMinutes?: number }): ParseSleepResult {
  const maxMinutes = opts?.maxMinutes ?? 24 * 60;

  const raw = (input ?? "").trim().toLowerCase();
  if (!raw) return { ok: false, error: "empty" };

  // clock: 7:30
  const clock = raw.match(/^\s*(\d{1,2})\s*:\s*(\d{1,2})\s*$/);
  if (clock) {
    const h = Number(clock[1]);
    const m = Number(clock[2]);
    if (!Number.isFinite(h) || !Number.isFinite(m) || m < 0 || m > 59) {
      return { ok: false, error: "invalid clock" };
    }
    const minutes = h * 60 + m;
    if (minutes < 0 || minutes > maxMinutes) return { ok: false, error: "out of range" };
    return { ok: true, minutes, normalized: formatMinutes(minutes), method: "clock" };
  }

  // tokens: 7h 30m, 7hr, 30min
  if (raw.includes("h") || raw.includes("m")) {
    const hMatch = raw.match(/(\d{1,2})\s*h/);
    const mMatch = raw.match(/(\d{1,2})\s*m/);

    const h = hMatch ? Number(hMatch[1]) : 0;
    const m = mMatch ? Number(mMatch[1]) : 0;

    if ((!hMatch && !mMatch) || !Number.isFinite(h) || !Number.isFinite(m) || m < 0 || m > 59) {
      return { ok: false, error: "invalid tokens" };
    }

    const minutes = h * 60 + m;
    if (minutes < 0 || minutes > maxMinutes) return { ok: false, error: "out of range" };
    return { ok: true, minutes, normalized: formatMinutes(minutes), method: "tokens" };
  }

  // decimal or integer hours: 7.5, 7, 7,5
  const num = raw.replace(",", ".");
  const m = num.match(/^\d+(?:\.\d+)?$/);
  if (m) {
    const hours = Number(num);
    if (!Number.isFinite(hours)) return { ok: false, error: "invalid number" };

    const minutes = Math.round(hours * 60);
    if (minutes < 0 || minutes > maxMinutes) return { ok: false, error: "out of range" };

    return {
      ok: true,
      minutes,
      normalized: formatMinutes(minutes),
      method: num.includes(".") ? "decimal" : "integer"
    };
  }

  return { ok: false, error: "unrecognized format" };
}
