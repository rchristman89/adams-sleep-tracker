# Azure Communication Services Setup Guide

This guide walks you through configuring Azure Communication Services (ACS) as the SMS provider for Adam's Sleep Tracker.

## Overview

When `SMS_PROVIDER=azure-communication` is set, the app will:
- **Send** outbound prompts and reminders via ACS SMS REST API
- **Receive** inbound replies via an ACS Event Grid webhook (`/api/acs/inbound`)
- **Reply** to confirmed sleep entries using ACS (or Infobip — see below)

> **ACS + Infobip hybrid:** ACS can be configured to route SMS through Infobip as the underlying carrier (via Azure Direct Routing or an ACS-connected Infobip channel). In that case, inbound messages still arrive through the ACS Event Grid webhook and you keep `SMS_PROVIDER=azure-communication`.
> If you want to bypass ACS entirely and use Infobip directly, see `setup-infobip.md`.

---

## Prereqs

- An Azure subscription with an **Azure Communication Services** resource.
- A phone number provisioned in the ACS resource (or Infobip number connected through ACS).

---

## 1) Create an ACS Resource

1. In Azure Portal, search for **Communication Services** and click **Create**.
2. Choose your subscription, resource group, and a unique resource name.
3. Click **Review + Create → Create**.

---

## 2) Get the ACS Connection String

1. Open the ACS resource → **Keys** (left menu).
2. Copy the **Connection string** (primary or secondary).
   It looks like:
   ```
   endpoint=https://<resource>.communication.azure.com/;accesskey=<base64key>
   ```

---

## 3) Provision a Phone Number

1. Open the ACS resource → **Phone numbers**.
2. Click **Get** and follow the wizard to obtain a toll-free or local number with **SMS** capability.
3. Note the number in E.164 format (e.g. `+18005551234`).

> If using Infobip-sourced numbers through ACS, follow Infobip's documentation for connecting their numbers to your ACS resource.

---

## 4) Configure Application Settings

Add these to your **Azure Static Web App → Configuration → Application settings** (or `.env` for local dev):

```
SMS_PROVIDER=azure-communication

ACS_CONNECTION_STRING=endpoint=https://<resource>.communication.azure.com/;accesskey=<base64key>
ACS_FROM_NUMBER=+1XXXXXXXXXX

ADAM_TO_NUMBER=+1XXXXXXXXXX          # Adam's phone number (recipient)
ADAM_FROM_NUMBER=                    # (optional) only accept replies from this number

AZURE_STORAGE_CONNECTION_STRING=<from storage account>
TIMEZONE=America/New_York
SLO_MINUTES=420
JOB_SECRET=<random secret>
```

---

## 5) Set Up the ACS Inbound Webhook

ACS routes inbound SMS to your endpoint via **Azure Event Grid**.

1. Open the ACS resource → **Events** (left menu).
2. Click **+ Event Subscription**.
3. Fill in:
   - **Name:** `sleep-tracker-sms-inbound`
   - **Event Schema:** `Cloud Event Schema v1.0`
   - **Filter to Event Types:** `Microsoft.Communication.SMSReceived`
   - **Endpoint Type:** `Web Hook`
   - **Endpoint URL:** `https://<your-swa-host>/api/acs/inbound`
4. Click **Create**.

> Azure Event Grid will send a subscription validation request to your endpoint automatically. The `acsInbound` function handles this handshake.

---

## 6) Logic Apps (Recurrence Schedules)

Use the same Logic App setup described in `setup-twilio-azure.md` (sections 4), replacing the Twilio-specific env vars with the ACS ones above. The HTTP action URLs (`/api/jobs/sendPrompt` and `/api/jobs/sendReminder`) remain the same.

---

## 7) Smoke Tests

```bash
# Test the outbound send (prompt)
curl -X POST "https://<your-swa-host>/api/jobs/sendPrompt" \
  -H "x-job-secret: <JOB_SECRET>"

# Test the outbound send (reminder)
curl -X POST "https://<your-swa-host>/api/jobs/sendReminder" \
  -H "x-job-secret: <JOB_SECRET>"
```

- **Inbound:** Send an SMS from Adam's number to the ACS number. The Event Grid subscription will forward the event to `/api/acs/inbound`.
- Check Azure Static Web Apps logs to confirm the event was processed.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `ACS send failed` (HTTP 401) | `ACS_CONNECTION_STRING` is incorrect or expired |
| `ACS response missing messageId` | Number may not have SMS enabled |
| Event Grid not triggering | Subscription not set to `SMSReceived`; check ACS → Events |
| Inbound validation 400 | Endpoint URL mismatch; redeploy and re-create the subscription |
