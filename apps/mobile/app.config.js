// Expo reads app.json first and hands it here as `config`.
//
// Push notifications need Firebase's google-services.json in the Android build.
// It is not committed: the APK workflow writes it from the GOOGLE_SERVICES_JSON
// secret. When it is absent (a fresh clone, or before the secret exists) the
// app still builds and runs; it simply cannot receive pushes.
const fs = require('fs')
const path = require('path')

//
// iOS (TG-172): the build number comes from the CI run (IOS_BUILD_NUMBER), so
// every TestFlight upload is higher than the last without anyone editing a file.
// Pushes on iPhone go straight to Apple (TG-173), so the push entitlement is the
// production one that TestFlight and the App Store use; a local debug build can
// ask for the sandbox with IOS_APS_ENV=development.
module.exports = ({ config }) => {
  const hasFirebase = fs.existsSync(path.join(__dirname, 'google-services.json'))
  return {
    ...config,
    ios: {
      ...config.ios,
      ...(process.env.IOS_BUILD_NUMBER ? { buildNumber: String(process.env.IOS_BUILD_NUMBER) } : {}),
    },
    android: {
      ...config.android,
      ...(hasFirebase ? { googleServicesFile: './google-services.json' } : {}),
    },
    plugins: [
      ...(config.plugins ?? []),
      ['expo-notifications', {
        icon: './assets/notification-icon.png', color: '#FF6B35', defaultChannel: 'buying',
        mode: process.env.IOS_APS_ENV === 'development' ? 'development' : 'production',
      }],
    ],
    extra: { ...config.extra, pushReady: hasFirebase },
  }
}
