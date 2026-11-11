// Expo reads app.json first and hands it here as `config`.
//
// Push notifications need Firebase's google-services.json in the Android build.
// It is not committed: the APK workflow writes it from the GOOGLE_SERVICES_JSON
// secret. When it is absent (a fresh clone, or before the secret exists) the
// app still builds and runs; it simply cannot receive pushes.
const fs = require('fs')
const path = require('path')

module.exports = ({ config }) => {
  const hasFirebase = fs.existsSync(path.join(__dirname, 'google-services.json'))
  return {
    ...config,
    android: {
      ...config.android,
      ...(hasFirebase ? { googleServicesFile: './google-services.json' } : {}),
    },
    plugins: [
      ...(config.plugins ?? []),
      ['expo-notifications', { icon: './assets/notification-icon.png', color: '#FF6B35', defaultChannel: 'buying' }],
    ],
    extra: { ...config.extra, pushReady: hasFirebase },
  }
}
