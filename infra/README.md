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
