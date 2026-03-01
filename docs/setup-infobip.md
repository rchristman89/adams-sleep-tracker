# Infobip Setup Guide

This guide walks you through configuring Infobip as the SMS provider for Adam's Sleep Tracker.

## Overview

When `SMS_PROVIDER=infobip` is set, the app will:
- **Send** outbound prompts and reminders via Infobip SMS API v2
- **Receive** inbound replies via an Infobip HTTP forwarding webhook (`/api/infobip/inbound`)
- **Reply** to confirmed sleep entries using Infobip

---

## Prereqs

- An [Infobip](https://www.infobip.com) account.
- A phone number provisioned in your Infobip account with **SMS** (two-way) capability.

---

## 1) Get Your API Key and Base URL

1. Log in to the [Infobip portal](https://portal.infobip.com).
2. Go to **Developers → API keys** and create or copy an existing API key.
3. Note your **Base URL** (shown in the portal and in API responses):
   ```
   xxxxx.api.infobip.com
   ```
   (Do not include `https://` — the app adds that automatically.)

---

## 2) Provision or Identify Your Phone Number

1. In the Infobip portal, go to **Channels → SMS** to view your numbers.
2. Note the sender number in E.164 format (e.g. `+18005551234`), or use an alphanumeric sender ID if your destination country supports it.

---

## 3) Configure Application Settings

Add these to your **Azure Static Web App → Configuration → Application settings** (or `.env` for local dev):

```
SMS_PROVIDER=infobip

INFOBIP_BASE_URL=<your-base-url>.api.infobip.com
INFOBIP_API_KEY=<api-key-from-portal>
INFOBIP_FROM=+1XXXXXXXXXX              # sender number or alphanumeric ID

ADAM_TO_NUMBER=+1XXXXXXXXXX            # Adam's phone number (recipient)
ADAM_FROM_NUMBER=                      # (optional) only accept replies from this number

AZURE_STORAGE_CONNECTION_STRING=<from storage account>
TIMEZONE=America/New_York
SLO_MINUTES=420
JOB_SECRET=<random secret>

# Optional: add a shared secret to the inbound webhook URL for basic security
# INFOBIP_WEBHOOK_SECRET=<random>
```

---

## 4) Set Up the Inbound Webhook

1. In the Infobip portal, go to **Channels → SMS → your number → Edit**.
2. Under **Forwarding**, select **HTTP Forwarding** and enter:
   ```
   https://<your-swa-host>/api/infobip/inbound
   ```
   or with the optional secret:
   ```
   https://<your-swa-host>/api/infobip/inbound?secret=<INFOBIP_WEBHOOK_SECRET>
   ```
3. Set the **HTTP method** to `POST` and content type to `application/json`.
4. Save.

> Infobip will POST a JSON payload to this URL each time an inbound SMS arrives on your number.

---

## 5) Logic Apps (Recurrence Schedules)

Use the same Logic App setup described in `setup-twilio-azure.md` (section 4), replacing the Twilio env vars with the Infobip ones above. The HTTP action URLs (`/api/jobs/sendPrompt` and `/api/jobs/sendReminder`) remain the same.

---

## 6) Smoke Tests

```bash
# Test the outbound send (prompt)
curl -X POST "https://<your-swa-host>/api/jobs/sendPrompt" \
  -H "x-job-secret: <JOB_SECRET>"

# Test the outbound send (reminder)
curl -X POST "https://<your-swa-host>/api/jobs/sendReminder" \
  -H "x-job-secret: <JOB_SECRET>"
```

- **Inbound:** Send an SMS from Adam's number to the Infobip number.
- The webhook will be called and the sleep entry saved.
- A reply SMS will be sent back via Infobip.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `Infobip send failed` (HTTP 401) | `INFOBIP_API_KEY` is missing or incorrect |
| `Infobip send failed` (HTTP 400) | Sender number not verified / wrong format |
| `Infobip response missing messageId` | Unexpected response shape; check logs |
| Inbound webhook 403 | `INFOBIP_WEBHOOK_SECRET` mismatch; update Infobip forwarding URL |
| Inbound webhook 500 | `AZURE_STORAGE_CONNECTION_STRING` or `ADAM_TO_NUMBER` missing |
