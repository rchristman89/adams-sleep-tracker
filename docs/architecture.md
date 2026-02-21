# Architecture (MVP)

## Components
- **Twilio** SMS (inbound + outbound)
- **Azure Functions**
  - `POST /api/twilio/inbound`
  - `POST /api/jobs/sendPrompt`
  - `POST /api/jobs/sendReminder`
  - `GET /api/stats`
- **Azure Table Storage**
  - `SleepEntries` (canonical 1 row per sleep_date)
  - `SmsEvents` (optional audit log)
- **Azure Static Web Apps** hosts the public site
- **Azure Logic Apps** schedules prompts/reminders in ET

## GET /api/stats (JSON shape)

```json
{
  "generatedAtUtc": "2026-02-21T15:00:00.000Z",
  "timezone": "America/New_York",
  "sloMinutes": 420,
  "endSleepDate": "2026-02-20",
  "averages": {
    "avgMinutes7": 410.5,
    "avgMinutes30": 395.2
  },
  "percentiles30": {
    "p50Minutes": 405,
    "p90Minutes": 460
  },
  "incidents30": {
    "incidents": 7,
    "sev1": 1
  },
  "reliability7": {
    "availability": 0.71,
    "errorBudget": 0.29,
    "knownNights": 7
  },
  "statusHistory30": [
    { "sleepDate": "2026-02-20", "status": "OK", "minutesSlept": 450 },
    { "sleepDate": "2026-02-21", "status": "UNKNOWN", "minutesSlept": null }
  ],
  "cumulativeBurnSeries": [
    { "sleepDate": "2026-02-20", "burn": 0, "cumulativeBurn": 0 }
  ]
}
```

Notes:
- `statusHistory30` includes **30 nights**, with `UNKNOWN` for missing days.
- `incidents30.incidents` counts **nights** with any non-OK status (DEGRADED/MAJOR/SEV1), not distinct “incident objects”.
- `percentiles30.p50Minutes` / `p90Minutes` may be `null` when there is no data in the 30d window yet.
- `cumulativeBurnSeries` starts at **BURN_SERIES_START_DATE** (default `2026-02-20`) and increments `cumulativeBurn` by `1` for each **known** night below SLO; `UNKNOWN` nights are treated as burn `0`.

## Rules
- Only input: sleep duration for last night
- Schedule: 09:00 ET prompt; 18:00 ET reminder if no reply that day
- Date mapping: any reply on date D (ET) => `sleep_date = D-1`
- Latest reply wins for a given `sleep_date`
- SLO: 7h/night (420 minutes)

## Status thresholds (minutes)
- OK: >= 420
- DEGRADED: 360–419
- MAJOR: 240–359
- SEV1: < 240
