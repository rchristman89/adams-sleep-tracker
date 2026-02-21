@description('Azure region for resources')
param location string

@description('SWA default hostname (used to build API URLs)')
param swaDefaultHostname string

@description('Job secret for x-job-secret header')
@secure()
param jobSecret string

var swaBaseUrl = 'https://${swaDefaultHostname}'

resource promptLogicApp 'Microsoft.Logic/workflows@2019-05-01' = {
  name: 'logic-sleep-send-prompt'
  location: location
  properties: {
    state: 'Enabled'
    definition: {
      '$schema': 'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#'
      contentVersion: '1.0.0.0'
      triggers: {
        Recurrence: {
          type: 'Recurrence'
          recurrence: {
            frequency: 'Day'
            interval: 1
            timeZone: 'Eastern Standard Time'
            schedule: {
              hours: [
                '9'
              ]
              minutes: [
                0
              ]
            }
          }
        }
      }
      actions: {
        HTTP_SendPrompt: {
          type: 'Http'
          inputs: {
            method: 'POST'
            uri: '${swaBaseUrl}/api/jobs/sendPrompt'
            headers: {
              'x-job-secret': '@parameters(\'jobSecret\')'
            }
          }
        }
      }
      parameters: {
        jobSecret: {
          type: 'SecureString'
        }
      }
    }
    parameters: {
      jobSecret: {
        value: jobSecret
      }
    }
  }
}

resource reminderLogicApp 'Microsoft.Logic/workflows@2019-05-01' = {
  name: 'logic-sleep-send-reminder'
  location: location
  properties: {
    state: 'Enabled'
    definition: {
      '$schema': 'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#'
      contentVersion: '1.0.0.0'
      triggers: {
        Recurrence: {
          type: 'Recurrence'
          recurrence: {
            frequency: 'Day'
            interval: 1
            timeZone: 'Eastern Standard Time'
            schedule: {
              hours: [
                '18'
              ]
              minutes: [
                0
              ]
            }
          }
        }
      }
      actions: {
        HTTP_SendReminder: {
          type: 'Http'
          inputs: {
            method: 'POST'
            uri: '${swaBaseUrl}/api/jobs/sendReminder'
            headers: {
              'x-job-secret': '@parameters(\'jobSecret\')'
            }
          }
        }
      }
      parameters: {
        jobSecret: {
          type: 'SecureString'
        }
      }
    }
    parameters: {
      jobSecret: {
        value: jobSecret
      }
    }
  }
}

output promptLogicAppId string = promptLogicApp.id
output reminderLogicAppId string = reminderLogicApp.id
