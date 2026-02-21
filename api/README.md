# API (Azure Functions)

This folder will host Azure Functions for:
- Twilio inbound webhook
- Job endpoints (send prompt/reminder)
- Stats endpoint

For now (Issue #3), it includes the **Azure Table Storage access layer** under `src/storage/`.

## Env vars
- `AZURE_STORAGE_CONNECTION_STRING` (required)
- `SLEEP_ENTRIES_TABLE` (optional, default `SleepEntries`)
- `SMS_EVENTS_TABLE` (optional, default `SmsEvents`)
- `TWILIO_RATE_LIMIT_WINDOW_SECONDS` (optional, default `60`)
- `TWILIO_RATE_LIMIT_MAX` (optional, default `5`)
- `ADAM_FROM_NUMBER` (optional, if set inbound must match)

## Health check
- `GET /api/health` returns `{ "status": "ok" }`
