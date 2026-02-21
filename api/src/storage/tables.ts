import { TableClient, type TableEntityResult } from "@azure/data-tables";
import { toIsoDate, type IsoDate, type SleepEntry, type SmsEvent } from "./types";

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
  } catch (err: unknown) {
    const maybe = err as { statusCode?: number };
    if (maybe?.statusCode === 404) return null;
    throw err;
  }
}

/**
 * Used by reminder logic:
 * "Has Adam replied today (ET)?" => any row with receivedAtLocalDate == today
 */
export async function hasReplyOnLocalDate(
  client: TableClient,
  localDate: string
): Promise<boolean> {
  const d = toIsoDate(localDate);

  // Simple OData equality filter.
  const filter = `PartitionKey eq '${SLEEP_PARTITION}' and receivedAtLocalDate eq '${d}'`;
  const iter = client.listEntities({ queryOptions: { filter } });
  for await (const _ of iter) return true;
  return false;
}

export async function listSleepEntriesSince(
  client: TableClient,
  since: string
): Promise<SleepEntry[]> {
  const d = toIsoDate(since);

  // RowKey is YYYY-MM-DD so lexical ordering matches chronological.
  const filter = `PartitionKey eq '${SLEEP_PARTITION}' and RowKey ge '${d}'`;
  const out: SleepEntry[] = [];
  const iter = client.listEntities({ queryOptions: { filter } });
  for await (const e of iter) out.push(sleepEntryFromEntity(e as TableEntityResult<Record<string, unknown>>));
  out.sort((a, b) => (a.sleepDate < b.sleepDate ? -1 : a.sleepDate > b.sleepDate ? 1 : 0));
  return out;
}

export async function insertSmsEvent(client: TableClient, ev: SmsEvent): Promise<void> {
  const entity = removeUndefinedProperties({
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
  });

  await client.upsertEntity(entity, "Replace");
}

function removeUndefinedProperties<T extends Record<string, unknown>>(obj: T): T {
  for (const key of Object.keys(obj)) {
    if (obj[key] === undefined) delete obj[key];
  }
  return obj;
}

function sleepEntryFromEntity(e: TableEntityResult<Record<string, unknown>>): SleepEntry {
  const get = (key: string): unknown => (e as Record<string, unknown>)[key];
  const rowKey = String(get("rowKey") ?? get("RowKey") ?? "");
  const sleepDate = toIsoDate(rowKey);

  const receivedAtLocalDate = toIsoDate(String(get("receivedAtLocalDate") ?? ""));

  return {
    sleepDate,
    minutesSlept: Number(get("minutesSlept")),
    rawReply: String(get("rawReply") ?? ""),
    receivedAtUtc: String(get("receivedAtUtc") ?? ""),
    receivedAtLocalDate,
    fromNumber: String(get("fromNumber") ?? ""),
    messageSid: String(get("messageSid") ?? ""),
    updatedAtUtc: String(get("updatedAtUtc") ?? "")
  };
}
