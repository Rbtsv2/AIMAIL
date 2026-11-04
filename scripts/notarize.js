// scripts/notarize.js
const { notarize } = require('@electron/notarize')

exports.default = async function (context) {
  if (context.electronPlatformName !== 'darwin') return
  if (!process.env.APPLE_ID) return
  const appName = context.packager.appInfo.productFilename
  await notarize({
    appBundleId: 'com.chilloutnetworks.aimail',
    appPath: `${context.appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID
  })
}