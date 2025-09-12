const path = require('path')
const fs = require('fs')
const { notarize } = require('@electron/notarize')

exports.default = async function afterSign(context) {
  const { electronPlatformName, appOutDir } = context

  if (electronPlatformName !== 'darwin') {
    return
  }

  const appName = context.packager.appInfo.productFilename

  const appleId = process.env.APPLE_ID
  const appleTeamId = process.env.APPLE_TEAM_ID
  const applePassword = process.env.APPLE_APP_SPECIFIC_PASSWORD

  if (!appleId || !appleTeamId || !applePassword) {
    console.warn('Skipping notarization: missing APPLE_ID / APPLE_TEAM_ID / APPLE_APP_SPECIFIC_PASSWORD')
    return
  }

  const appPath = path.join(appOutDir, `${appName}.app`)
  if (!fs.existsSync(appPath)) {
    throw new Error(`Cannot find app at: ${appPath}`)
  }

  console.log('Notarizing app with Apple...')
  await notarize({
    tool: 'notarytool',
    appBundleId: context.packager.appInfo.bundleId,
    appPath,
    appleId,
    teamId: appleTeamId,
    password: applePassword,
  })
  console.log('Notarization complete')
}


