targetScope = 'subscription'

@description('Azure region for the resource group and resources')
param location string = 'eastus'

@description('Resource group name')
param resourceGroupName string

@description('Globally-unique storage account name (lowercase)')
param storageAccountName string

@description('Name for the Static Web App')
param swaName string

@description('GitHub repo URL')
param repositoryUrl string = 'https://github.com/rchristman89/adams-sleep-tracker'

@description('GitHub branch')
param branch string = 'main'

@description('GitHub personal access token for repo access')
@secure()
param repositoryToken string

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

resource rg 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: resourceGroupName
  location: location
}

module storage 'storage.bicep' = {
  name: 'storageDeployment'
  scope: rg
  params: {
    storageAccountName: storageAccountName
    location: location
  }
}

module swa 'staticWebApp.bicep' = {
  name: 'swaDeployment'
  scope: rg
  params: {
    name: swaName
    location: location
    repositoryUrl: repositoryUrl
    branch: branch
    repositoryToken: repositoryToken
    storageAccountName: storage.outputs.storageAccountName
    jobSecret: jobSecret
    twilioAccountSid: twilioAccountSid
    twilioAuthToken: twilioAuthToken
    twilioFromNumber: twilioFromNumber
    adamToNumber: adamToNumber
  }
}

module logicApps 'logicApps.bicep' = {
  name: 'logicAppsDeployment'
  scope: rg
  params: {
    location: location
    swaDefaultHostname: swa.outputs.swaDefaultHostname
    jobSecret: jobSecret
  }
}

output resourceGroupId string = rg.id
output storageAccountId string = storage.outputs.storageAccountId
output swaDefaultHostname string = swa.outputs.swaDefaultHostname
