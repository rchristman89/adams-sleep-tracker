@description('Name for the Static Web App')
param name string

@description('Azure region (SWA supports limited regions)')
param location string

@description('GitHub repo URL')
param repositoryUrl string

@description('GitHub branch')
param branch string = 'main'

@description('GitHub personal access token for repo access')
@secure()
param repositoryToken string

@description('Storage account name (used to build connection string)')
param storageAccountName string

@description('Job secret for scheduled endpoints')
@secure()
param jobSecret string

@description('Twilio Account SID')
@secure()
param twilioAccountSid string

@description('Twilio Auth Token')
@secure()
param twilioAuthToken string

@description('Twilio From number')
param twilioFromNumber string

@description('Adam To number')
param adamToNumber string

@description('Timezone')
param timezone string = 'America/New_York'

@description('SLO minutes')
param sloMinutes string = '420'

resource swa 'Microsoft.Web/staticSites@2022-09-01' = {
  name: name
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    repositoryUrl: repositoryUrl
    branch: branch
    repositoryToken: repositoryToken
    buildProperties: {
      appLocation: 'web'
      apiLocation: 'api'
      outputLocation: 'dist'
    }
  }
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: storageAccountName
}

resource swaAppSettings 'Microsoft.Web/staticSites/config@2022-09-01' = {
  parent: swa
  name: 'appsettings'
  properties: {
    AZURE_STORAGE_CONNECTION_STRING: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
    TIMEZONE: timezone
    SLO_MINUTES: sloMinutes
    JOB_SECRET: jobSecret
    TWILIO_ACCOUNT_SID: twilioAccountSid
    TWILIO_AUTH_TOKEN: twilioAuthToken
    TWILIO_FROM_NUMBER: twilioFromNumber
    ADAM_TO_NUMBER: adamToNumber
  }
}

output swaId string = swa.id
output swaDefaultHostname string = swa.properties.defaultHostname
