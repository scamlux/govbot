# GovBot mobile (Capacitor)

Android (and later iOS) app around the live web app. The WebView loads
`https://govbot-web.vercel.app` (`server.url` in `capacitor.config.json`), so sign-in cookies,
SSE chat streaming and the service-worker offline catalog work exactly as on the site, and every
web deploy reaches the app without a store release. `www/offline.html` is shown when the site
cannot load. Native plugins (status bar, splash, local notifications, share, haptics) are
available to the web code through `window.Capacitor` — the web app feature-detects them.

App id: `uz.govbot.app` · min Android 7.0 (API 24) · target API 36.

## Build an APK

Requirements: JDK 21, Android SDK (platforms 36, build-tools 36). On macOS:

```bash
brew install --cask android-commandlinetools
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
sdkmanager --sdk_root=$ANDROID_HOME "platform-tools" "platforms;android-36" "build-tools;36.0.0"
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

npm install
npm run assets   # icons + splash from assets/*.png
npm run apk      # cap sync + gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

## Release signing

The keystore is never committed. `android/app/build.gradle` reads
`~/.govbot/keystore.properties` (or the path in `GOVBOT_KEYSTORE_PROPS`):

```properties
storeFile=/absolute/path/govbot-release.jks
storePassword=…
keyAlias=govbot
keyPassword=…
```

Without that file the release APK is built unsigned. **Back up the keystore** — Google Play
updates must be signed with the same key.

## iOS

Needs Xcode on macOS and an Apple Developer account: `npx cap add ios`, then build in Xcode.
