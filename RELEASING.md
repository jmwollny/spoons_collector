# Releasing the Android app

How to build a signed APK you can install on any Android phone, and keep
updating.

## The signing key

Android only lets an app update an installed one signed with the **same
key**. Spoons Collector's key lives outside the repo:

- the key: `~/.android/spoons-collector-release.jks`
- its passwords: `~/.gradle/gradle.properties` (`SPOONS_RELEASE_*`)

**Back both up somewhere safe and private** (a password manager is ideal).
If the key is lost, the installed app can never be updated: you'd have to
uninstall it, losing its visits unless they're backed up, and install a
newly signed one. Never commit either file (`*.jks` is git-ignored).

`android/app/build.gradle` signs release builds, and Android Studio's Run
builds, with this key when `~/.gradle/gradle.properties` names it. Without
it (e.g. in CI), builds work as before: release unsigned, Run with Android
Studio's debug key.

### Making a key on a new computer

Copy the two files above across. Only if the key is truly lost, make a new
one (and expect to reinstall the app, as above):

```bash
keytool -genkeypair -v -keystore ~/.android/spoons-collector-release.jks \
  -storetype PKCS12 -alias spoons-collector -keyalg RSA -keysize 4096 \
  -validity 10000 -dname "CN=Spoons Collector"
```

then add `SPOONS_RELEASE_STORE_FILE`, `SPOONS_RELEASE_STORE_PASSWORD`,
`SPOONS_RELEASE_KEY_ALIAS` (`spoons-collector`) and
`SPOONS_RELEASE_KEY_PASSWORD` to `~/.gradle/gradle.properties`.

## Building

1. Bump `versionCode` (by 1) and `versionName` in `android/app/build.gradle`.
   A phone won't install an update with the same or a lower `versionCode`.
2. Build:

   ```bash
   npm run build
   npx cap sync android
   cd android && ./gradlew assembleRelease
   ```

   (On a Mac without Java installed, prefix `./gradlew` with
   `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`.)
3. The APK is `android/app/build/outputs/apk/release/app-release.apk`.

### Your own copy, or one to share

The pub photos are Wetherspoon's, so there are two kinds of build:

- **Your own** (`npm run build`, as above): includes our copies from
  `public/images`, so photos are fast and work offline. Keep this one to
  yourself.
- **Shareable** (`npm run build:shareable` in place of `npm run build`):
  leaves the photos out and loads each one from Wetherspoon's site when
  it's shown, so the APK (about 3 MB rather than 37 MB) doesn't
  redistribute them. Use this for anything public, e.g. a GitHub Release.
  Photos then need a connection.

Either way, the ☰ menu credits the photos to J D Wetherspoon plc.

## Installing

With the phone connected (USB or wireless debugging):

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Or copy the APK to the phone and open it (Android asks to allow installing
apps from that source).

**The first time** only: an app installed earlier from Android Studio was
signed with Android Studio's own debug key, so it must be uninstalled
first, which deletes its visits. Back them up from the ☰ menu, uninstall,
install the APK, then restore from the backup. Photos aren't in backups;
they're lost with the uninstall.

## Icon and splash screen

The launcher icon and splash screen come from `resources/`, drawn from the
pint in `public/favicon.svg`. To change them, edit `resources/render.html`
or `resources/pint.svg`, then, with the dev server on port 5199 and
headless Chrome on port 9333:

```bash
node --experimental-websocket resources/render.mjs
npx capacitor-assets generate --android --assetPath resources \
  --iconBackgroundColor '#1d4ed8' --iconBackgroundColorDark '#1d4ed8' \
  --splashBackgroundColor '#1d4ed8' --splashBackgroundColorDark '#0f172a'
git checkout android/app/src/main/AndroidManifest.xml  # the tool reformats it
```
