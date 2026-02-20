targetScope = 'subscription'

@description('Azure region for the resource group and resources')
param location string = 'eastus'

@description('Resource group name')
param resourceGroupName string

@description('Globally-unique storage account name (lowercase)')
param storageAccountName string

resource rg 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: resourceGroupName
  location: location
}

resource st 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  scope: rg
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

// NOTE: Table resources are created via CLI in infra/README.md for simplicity.

output resourceGroupId string = rg.id
output storageAccountId string = st.id
