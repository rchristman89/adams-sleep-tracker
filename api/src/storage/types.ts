export type IsoDate = `${number}-${number}-${number}`; // YYYY-MM-DD

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
