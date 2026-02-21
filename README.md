# Adam's Sleep Tracker

Public read-only “Newborn SRE Uptime” dashboard driven by a daily SMS reply.

## MVP
- Twilio SMS inbound webhook parses last-night sleep (7.5 / 7h30m / 7:30)
- Any reply received on local ET day **D** is recorded for **sleep_date = D-1**
- Latest reply wins for that sleep_date
- Public site shows status, stats, charts, and 30-day status history bar

## Stack (Azure)
- Azure Static Web Apps (frontend)
- Azure Functions (API)
- Azure Table Storage (data)
- Azure Logic Apps (09:00 ET prompt + 18:00 ET reminder)

## Docs
- See `docs/architecture.md`
- See `docs/dev-process.md` (required workflow)
- See `docs/setup-twilio-azure.md` (Twilio + Azure setup guide)
- See `infra/README.md` (Azure provisioning)
