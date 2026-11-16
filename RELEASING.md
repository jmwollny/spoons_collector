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
2. Build, all in one go:

   ```bash
   npm run apk            # shareable: photos load from Wetherspoon's site
   npm run apk -- --own   # your own: photos included
   ```

   This puts the APK in `apk/` (git-ignored), named by version and kind,
   e.g. `apk/spoons-collector-1.1-shareable.apk`. Or, step by step:

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
  leaves the photos and the pub histories out, and loads each from
  Wetherspoon's site when it's shown (a history when its card is turned
  over or it makes a treasure-hunt clue), so the APK (about 3 MB rather than 37 MB) doesn't
  redistribute them. Use this for anything public, e.g. a GitHub Release.
  They then need a connection the first time.

A shareable build keeps each photo and history on the phone once it's been
loaded, so those already seen work without a connection. The histories
need each pub's `historyId` in the data (see REGENERATING_DATA.md); the
build warns if any are missing.

Either way, the ☰ menu credits the photos and histories to J D Wetherspoon plc.

## Publishing a release

Put the shareable APK on GitHub as a release, tagged `v` and the
`versionName`, e.g. `v1.2`:

```bash
gh release create v1.2 apk/spoons-collector-1.2-shareable.apk --title "Spoons Collector 1.2"
```

Installed copies of the app check GitHub's latest release once a day, and
show "Version 1.2 of Spoons Collector is out" if it's newer than
themselves, with a link to the release. So the tag must match the
`versionName`, or the notice is wrong or never shows.

## Installing

With the phone connected (USB or wireless debugging):

```bash
/your project path/spoons_collector/android
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Or copy the APK to the phone and open it (Android asks to allow installing
apps from that source).

**The first time** only: an app installed earlier from Android Studio was
signed with Android Studio's own debug key, so it must be uninstalled
first, which deletes its visits. Back them up from the ☰ menu, uninstall,
install the APK, then restore from the backup. Visit photos come back too,
as long as "Photos in backups" was on in the menu (it is unless turned off).

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
