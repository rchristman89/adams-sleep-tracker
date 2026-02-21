# Twilio + Azure Setup Guide

Copy/paste friendly setup for the MVP stack.

## Prereqs
- Azure subscription with access to create Static Web Apps, Storage Accounts, and Logic Apps.
- Twilio account with SMS-capable number.
- (Optional) Namecheap domain.

## 1) Azure infra (Storage)
Follow `infra/README.md` to provision the resource group + storage account + tables.

## 2) Azure Static Web Apps (deploy)
1. Create a **Static Web App** in Azure Portal.
2. Link GitHub repo: `rchristman89/adams-sleep-tracker`.
3. Build settings:
   - **App location:** `web`
   - **Api location:** `api`
   - **Output location:** `dist`
4. After the app is created, open **Configuration → Application settings** and add:

```
AZURE_STORAGE_CONNECTION_STRING=<from storage account>
TIMEZONE=America/New_York
SLO_MINUTES=420
JOB_SECRET=<random>
TWILIO_ACCOUNT_SID=<from Twilio>
TWILIO_AUTH_TOKEN=<from Twilio>
TWILIO_FROM_NUMBER=+1XXXXXXXXXX
ADAM_TO_NUMBER=+1XXXXXXXXXX
# Optional: override URL used for Twilio signature verification
TWILIO_WEBHOOK_URL=https://<your-domain-or-swa-host>/api/twilio/inbound
```

> Tip: If you add a custom domain, set `TWILIO_WEBHOOK_URL` to the **exact** URL Twilio will call.

## 3) Twilio number + webhook
1. Buy/assign a Twilio number with **SMS** capability.
2. In Twilio Console → **Phone Numbers → Active numbers → <your number>**:
   - **Messaging → A message comes in**
     - **Webhook:** `https://<your-swa-host>/api/twilio/inbound`
     - **Method:** `POST`
3. Copy these into SWA env vars (above):
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_FROM_NUMBER`
   - `ADAM_TO_NUMBER`

## 4) Logic Apps (recurrence schedules)
Create **two** Consumption Logic Apps (or two workflows in a Standard Logic App):

### Logic App A: 09:00 ET prompt
- Trigger: **Recurrence**
  - Frequency: Day
  - Interval: 1
  - Time zone: **(UTC-05:00) Eastern Time (US & Canada)**
  - At these hours: **9**
  - At these minutes: **0**
- Action: **HTTP**
  - Method: POST
  - URI: `https://<your-swa-host>/api/jobs/sendPrompt`
  - Headers:
    - `x-job-secret`: `<JOB_SECRET>`

### Logic App B: 18:00 ET reminder
- Trigger: **Recurrence**
  - Frequency: Day
  - Interval: 1
  - Time zone: **(UTC-05:00) Eastern Time (US & Canada)**
  - At these hours: **18**
  - At these minutes: **0**
- Action: **HTTP**
  - Method: POST
  - URI: `https://<your-swa-host>/api/jobs/sendReminder`
  - Headers:
    - `x-job-secret`: `<JOB_SECRET>`

## 5) Namecheap DNS → Azure custom domain
1. In Azure Portal → Static Web App → **Custom domains** → **Add**.
2. Azure will show DNS records to create. Common patterns:

### Subdomain (recommended: `www`)
Add a CNAME in Namecheap:
- **Host:** `www`
- **Value:** `<your-swa-host>.azurestaticapps.net`

### Apex/root domain (`@`)
- If Namecheap supports **ALIAS/ANAME**, set:
  - **Host:** `@`
  - **Value:** `<your-swa-host>.azurestaticapps.net`
- If ALIAS isn’t available, point `@` to a URL redirect → `www`.

Azure may also request a TXT record for verification, e.g.:
- **Host:** `asuid` (or `asuid.<subdomain>`)
- **Value:** `<provided by Azure>`

## 6) Quick smoke tests
- **Twilio inbound:** send an SMS to the Twilio number.
- **Job endpoints:**
  ```bash
  curl -X POST "https://<your-swa-host>/api/jobs/sendPrompt" \
    -H "x-job-secret: <JOB_SECRET>"

  curl -X POST "https://<your-swa-host>/api/jobs/sendReminder" \
    -H "x-job-secret: <JOB_SECRET>"
  ```

If Twilio signature validation fails, double-check that the webhook URL Twilio uses exactly matches `TWILIO_WEBHOOK_URL` (or the raw request URL) including scheme and domain.
