# Infrastructure (Azure)

This folder contains Infrastructure-as-Code and setup notes for the MVP.

## What we provision
- Resource Group
- Storage Account (Table Storage)
- (Optional) Application Insights

> Note: Azure Static Web Apps GitHub linkage and Logic Apps are easiest to configure in the portal for MVP.

## Quickstart (Azure CLI)

### 1) Login + set subscription
```bash
az login
az account set --subscription <SUBSCRIPTION_ID>
```

### 2) Deploy Bicep
```bash
az deployment sub create \
  --location eastus \
  --template-file infra/main.bicep \
  --parameters \
    location=eastus \
    resourceGroupName=rg-adams-sleep-tracker \
    storageAccountName=<globally-unique-lowercase>
```

### 3) Create Tables
```bash
# get connection string
CS=$(az storage account show-connection-string -g rg-adams-sleep-tracker -n <storageAccountName> --query connectionString -o tsv)

# create tables
az storage table create --name SleepEntries --connection-string "$CS"
az storage table create --name SmsEvents --connection-string "$CS"
```

### 4) Static Web App (manual for MVP)
- Create Static Web App in Azure Portal
- Link to GitHub repo: `rchristman89/adams-sleep-tracker`
- Build settings:
  - App location: `web`
  - Api location: `api` (to be added)
  - Output location: `dist`

### 5) Configure App Settings (secrets)
Set these in SWA configuration:
- `AZURE_STORAGE_CONNECTION_STRING`
- `TIMEZONE=America/New_York`
- `SLO_MINUTES=420`
- `JOB_SECRET=<random>`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `ADAM_TO_NUMBER`

### 6) Logic Apps schedules (manual for MVP)
Create **two** Consumption Logic Apps in Azure Portal (or two workflows in a Standard Logic App if you prefer). The goal is to POST into the job endpoints added in issue #6.

#### Logic App A: 09:00 ET prompt
- Trigger: **Recurrence**
  - Frequency: Day
  - Interval: 1
  - Time zone: **Eastern Standard Time**
  - At these hours: **9**
  - At these minutes: **0**
- Action: **HTTP**
  - Method: POST
  - URI: `https://<your-swa-host>/api/jobs/sendPrompt`
  - Headers:
    - `x-job-secret`: `<JOB_SECRET>`

#### Logic App B: 18:00 ET reminder
- Trigger: **Recurrence**
  - Frequency: Day
  - Interval: 1
  - Time zone: **Eastern Standard Time**
  - At these hours: **18**
  - At these minutes: **0**
- Action: **HTTP**
  - Method: POST
  - URI: `https://<your-swa-host>/api/jobs/sendReminder`
  - Headers:
    - `x-job-secret`: `<JOB_SECRET>`

#### Storing the job secret securely
For MVP, you can store the header value as a **Secure Input** / **Secure Parameter** in the Logic App designer so it isn’t visible in run history.

If you want it “properly” secured:
- Put `JOB_SECRET` in **Azure Key Vault**
- Give the Logic App a **Managed Identity**
- Use a **Key Vault get secret** step to retrieve it at runtime
- Pass it to the HTTP action header

#### Verify it’s working
- In each Logic App, check **Runs history**:
  - 09:00 ET workflow should show 200 response from `/sendPrompt`
  - 18:00 ET workflow should show either:
    - 200 `{ skipped: true }` if Adam already replied that day, or
    - 200 with a new outbound messageSid if a reminder was sent
