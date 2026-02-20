import { TableClient, type TableEntityResult } from "@azure/data-tables";
import type { IsoDate, SleepEntry, SmsEvent } from "./types";

const SLEEP_PARTITION = "sleep";
const SMS_PARTITION = "sms";

export type TableStorageConfig = {
  connectionString: string;
  sleepEntriesTable?: string; // default SleepEntries
  smsEventsTable?: string; // default SmsEvents
};

export function getSleepEntriesClient(cfg: TableStorageConfig): TableClient {
  return TableClient.fromConnectionString(cfg.connectionString, cfg.sleepEntriesTable ?? "SleepEntries");
}

export function getSmsEventsClient(cfg: TableStorageConfig): TableClient {
  return TableClient.fromConnectionString(cfg.connectionString, cfg.smsEventsTable ?? "SmsEvents");
}

export function sleepEntryKeys(sleepDate: IsoDate) {
  return { partitionKey: SLEEP_PARTITION, rowKey: sleepDate };
}

export async function upsertSleepEntry(
  client: TableClient,
  entry: SleepEntry
): Promise<void> {
  const { partitionKey, rowKey } = sleepEntryKeys(entry.sleepDate);

  await client.upsertEntity(
    {
      partitionKey,
      rowKey,
      minutesSlept: entry.minutesSlept,
      rawReply: entry.rawReply,
      receivedAtUtc: entry.receivedAtUtc,
      receivedAtLocalDate: entry.receivedAtLocalDate,
      fromNumber: entry.fromNumber,
      messageSid: entry.messageSid,
      updatedAtUtc: entry.updatedAtUtc
    },
    "Replace"
  );
}

export async function getSleepEntry(
  client: TableClient,
  sleepDate: IsoDate
): Promise<SleepEntry | null> {
  try {
    const e = (await client.getEntity(SLEEP_PARTITION, sleepDate)) as TableEntityResult<Record<string, unknown>>;
    return sleepEntryFromEntity(e);
  } catch (err: any) {
    if (err?.statusCode === 404) return null;
    throw err;
  }
}

/**
 * Used by reminder logic:
 * "Has Adam replied today (ET)?" => any row with receivedAtLocalDate == today
 */
export async function hasReplyOnLocalDate(
  client: TableClient,
  localDate: IsoDate
): Promise<boolean> {
  // Simple OData equality filter.
  const filter = `PartitionKey eq '${SLEEP_PARTITION}' and receivedAtLocalDate eq '${localDate}'`;
  const iter = client.listEntities({ queryOptions: { filter } });
  for await (const _ of iter) return true;
  return false;
}

export async function listSleepEntriesSince(
  client: TableClient,
  since: IsoDate
): Promise<SleepEntry[]> {
  // RowKey is YYYY-MM-DD so lexical ordering matches chronological.
  const filter = `PartitionKey eq '${SLEEP_PARTITION}' and RowKey ge '${since}'`;
  const out: SleepEntry[] = [];
  const iter = client.listEntities({ queryOptions: { filter } });
  for await (const e of iter) out.push(sleepEntryFromEntity(e as any));
  out.sort((a, b) => (a.sleepDate < b.sleepDate ? -1 : a.sleepDate > b.sleepDate ? 1 : 0));
  return out;
}

export async function insertSmsEvent(client: TableClient, ev: SmsEvent): Promise<void> {
  await client.upsertEntity(
    {
      partitionKey: SMS_PARTITION,
      rowKey: ev.messageSid,
      direction: ev.direction,
      body: ev.body,
      fromNumber: ev.fromNumber,
      toNumber: ev.toNumber,
      timestampUtc: ev.timestampUtc,
      parsedMinutes: ev.parsedMinutes,
      parseStatus: ev.parseStatus,
      parseError: ev.parseError,
      relatedSleepDate: ev.relatedSleepDate
    },
    "Replace"
  );
}

function sleepEntryFromEntity(e: any): SleepEntry {
  return {
    sleepDate: e.rowKey ?? e.RowKey,
    minutesSlept: Number(e.minutesSlept),
    rawReply: String(e.rawReply ?? ""),
    receivedAtUtc: String(e.receivedAtUtc ?? ""),
    receivedAtLocalDate: String(e.receivedAtLocalDate ?? ""),
    fromNumber: String(e.fromNumber ?? ""),
    messageSid: String(e.messageSid ?? ""),
    updatedAtUtc: String(e.updatedAtUtc ?? "")
  } as SleepEntry;
}
