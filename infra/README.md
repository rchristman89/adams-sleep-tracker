# Infrastructure (Azure)

This folder contains Infrastructure-as-Code and setup notes for the MVP.

## What we provision
- Resource Group
- Storage Account (Table Storage) with `SleepEntries` and `SmsEvents` tables
- Static Web App (linked to GitHub, with app settings / secrets)
- Logic Apps (two scheduled workflows: 09:00 ET prompt, 18:00 ET reminder)
- (Optional) Application Insights

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
    storageAccountName=<globally-unique-lowercase> \
    swaName=<static-web-app-name> \
    repositoryToken=<github-pat> \
    jobSecret=<random> \
    twilioAccountSid=<sid> \
    twilioAuthToken=<token> \
    twilioFromNumber=<from-number> \
    adamToNumber=<to-number>
```

This single command provisions:
- Resource Group
- Storage Account with `SleepEntries` and `SmsEvents` tables
- Static Web App (linked to GitHub repo with build settings)
- All SWA app settings / secrets
- Two Logic Apps (09:00 ET prompt + 18:00 ET reminder), with job secret stored as a secure parameter

#### Parameter reference
| Parameter | Description |
|---|---|
| `location` | Azure region (e.g. `eastus`, `eastus2`). Must support SWA — see [SWA supported regions](https://learn.microsoft.com/en-us/azure/static-web-apps/overview#regional-availability). |
| `resourceGroupName` | Name for the resource group (e.g. `rg-adams-sleep-tracker`). |
| `storageAccountName` | Globally unique, lowercase, 3-24 chars, letters and numbers only. |
| `swaName` | Name for the Static Web App resource. |
| `repositoryToken` | GitHub **classic** PAT with **`repo`** and **`workflow`** scopes. Generate at GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic). Fine-grained tokens are not supported. |
| `jobSecret` | Any random string used to authenticate Logic App → API calls. Generate one with: `openssl rand -base64 32` |
| `twilioAccountSid` | Your Twilio Account SID (starts with `AC`). Found on the Twilio Console dashboard. |
| `twilioAuthToken` | Your Twilio Auth Token. Found on the Twilio Console dashboard. |
| `twilioFromNumber` | Twilio phone number to send SMS from, in E.164 format (e.g. `+18005551234`). |
| `adamToNumber` | Adam's phone number to receive SMS, in E.164 format (e.g. `+15745551234`). |

### 3) Verify Logic Apps
After deployment, check **Runs history** in the Azure Portal for each Logic App:
- `logic-sleep-send-prompt` — fires at 09:00 ET daily, POSTs to `/api/jobs/sendPrompt`
- `logic-sleep-send-reminder` — fires at 18:00 ET daily, POSTs to `/api/jobs/sendReminder`
