#!/usr/bin/env bash
set -euo pipefail

readonly project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly required_java_major=17
readonly required_platform=36
readonly required_build_tools=35.0.0
readonly apk="$project_dir/app/build/outputs/apk/debug/app-debug.apk"

fail() {
  printf 'Android debug build prerequisite failed: %s\n' "$*" >&2
  exit 1
}

[[ -n "${JAVA_HOME:-}" ]] || fail 'JAVA_HOME must point to JDK 17.'
[[ -x "$JAVA_HOME/bin/java" && -x "$JAVA_HOME/bin/javac" ]] || fail "JAVA_HOME is not a complete JDK: $JAVA_HOME"

java_version="$("$JAVA_HOME/bin/java" -version 2>&1 | head -n 1)"
java_major="$(sed -E 's/.*version "([0-9]+).*/\1/' <<<"$java_version")"
[[ "$java_major" == "$required_java_major" ]] || fail "JDK 17 is required for reproducible builds; found: $java_version"

if [[ -n "${ANDROID_SDK_ROOT:-}" && -n "${ANDROID_HOME:-}" && "$ANDROID_SDK_ROOT" != "$ANDROID_HOME" ]]; then
  fail 'ANDROID_SDK_ROOT and ANDROID_HOME must identify the same SDK when both are set.'
fi
sdk_root="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
[[ -n "$sdk_root" ]] || fail 'Set ANDROID_SDK_ROOT or ANDROID_HOME to an existing Android SDK.'
[[ -d "$sdk_root/platforms/android-$required_platform" ]] || fail "Android SDK Platform $required_platform is missing under $sdk_root/platforms."
[[ -d "$sdk_root/build-tools/$required_build_tools" ]] || fail "Android SDK Build-Tools $required_build_tools is missing under $sdk_root/build-tools."

export ANDROID_SDK_ROOT="$sdk_root"
export ANDROID_HOME="$sdk_root"
export PATH="$JAVA_HOME/bin:$PATH"

printf 'Building Cheffo debug APK with %s, Android Platform %s, and Build-Tools %s.\n' \
  "$java_version" "$required_platform" "$required_build_tools"
"$project_dir/gradlew" --no-daemon --project-dir "$project_dir" :app:assembleDebug
[[ -f "$apk" ]] || fail "Gradle completed without producing $apk"
printf 'Debug APK: %s\n' "$apk"
