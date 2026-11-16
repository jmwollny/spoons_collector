#!/usr/bin/env bash
# Builds the web app and a signed release APK.
#
#   npm run apk            shareable build: photos load from Wetherspoon's site
#   npm run apk -- --own   your own build: photos bundled in the APK
#
# See RELEASING.md. The version comes from android/app/build.gradle; bump it
# yourself when you want to.
set -euo pipefail

cd "$(dirname "$0")/.."

kind=shareable
for arg in "$@"; do
  case "$arg" in
    --own) kind=own ;;
    --shareable) kind=shareable ;;
    -h|--help)
      sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (use --own or --shareable)" >&2
      exit 1
      ;;
  esac
done

# Gradle needs Java; on a Mac without it, use Android Studio's
studio_java="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
if [[ -z "${JAVA_HOME:-}" && -d "$studio_java" ]]; then
  export JAVA_HOME="$studio_java"
fi

echo "==> Building the web app ($kind)"
if [[ "$kind" == own ]]; then
  npm run build
else
  npm run build:shareable
fi

echo "==> Copying it into the Android project"
npx cap sync android

echo "==> Building the APK"
(cd android && ./gradlew assembleRelease)

version=$(sed -n 's/.*versionName "\(.*\)".*/\1/p' android/app/build.gradle | head -n 1)
built=android/app/build/outputs/apk/release/app-release.apk
if [[ ! -f "$built" ]]; then
  # Without the signing key (see RELEASING.md), Gradle makes an unsigned APK
  echo "No signed APK at $built: is the signing key set up? See RELEASING.md." >&2
  exit 1
fi

mkdir -p apk
apk="apk/spoons-collector-${version}-${kind}.apk"
cp "$built" "$apk"

echo
echo "==> Done: $apk ($(du -h "$apk" | cut -f1 | xargs))"
if [[ "$kind" == own ]]; then
  echo "    Includes Wetherspoon's photos: keep this one to yourself."
else
  echo "    To publish it (the app tells its users about a new version):"
  echo "    gh release create v$version $apk --title \"Spoons Collector $version\""
fi
