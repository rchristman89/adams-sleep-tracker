import { toIsoDate, type IsoDate } from "../storage/types";

export function isoDateInTimeZone(date: Date, timeZone: string): IsoDate {
  // Use formatToParts for stable YYYY-MM-DD
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return toIsoDate(`${y}-${m}-${d}`);
}

export function addDays(date: IsoDate, deltaDays: number): IsoDate {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return toIsoDate(`${yyyy}-${mm}-${dd}`);
}
