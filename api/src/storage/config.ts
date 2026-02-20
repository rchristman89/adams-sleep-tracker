import type { TableStorageConfig } from "./tables";

export function getTableStorageConfigFromEnv(env = process.env): TableStorageConfig {
  const cs = env.AZURE_STORAGE_CONNECTION_STRING;
  if (!cs) throw new Error("AZURE_STORAGE_CONNECTION_STRING is required");

  return {
    connectionString: cs,
    sleepEntriesTable: env.SLEEP_ENTRIES_TABLE ?? "SleepEntries",
    smsEventsTable: env.SMS_EVENTS_TABLE ?? "SmsEvents"
  };
}
