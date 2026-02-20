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
