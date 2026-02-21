declare const isoDateBrand: unique symbol;

/**
 * YYYY-MM-DD (structural validation at runtime via `isIsoDate` / `toIsoDate`).
 *
 * Note: we use a branded string instead of a template-literal type because the
 * fully-expanded union can become too complex for TypeScript to represent.
 */
export type IsoDate = string & { readonly [isoDateBrand]: true };

export function isIsoDate(value: string): value is IsoDate {
  // Structural check only (does not validate actual calendar dates)
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function toIsoDate(value: string): IsoDate {
  if (!isIsoDate(value)) throw new Error(`Invalid IsoDate: ${value}`);
  return value;
}

export type SleepEntry = {
  sleepDate: IsoDate;
  minutesSlept: number;
  rawReply: string;
  receivedAtUtc: string; // ISO
  receivedAtLocalDate: IsoDate; // ET local date when message received
  fromNumber: string;
  messageSid: string;
  updatedAtUtc: string; // ISO
};

export type SmsEvent = {
  messageSid: string;
  direction: "inbound" | "outbound";
  body: string;
  fromNumber: string;
  toNumber: string;
  timestampUtc: string; // ISO
  parsedMinutes?: number;
  parseStatus?: "ok" | "error";
  parseError?: string;
  relatedSleepDate?: IsoDate;
};
