# Cheffo Doggo Android QA

This native Android project opens the existing Cheffo PWA through Android Browser Helper. No web-to-native rewrite, Play Billing implementation, or store release is implied.

## Current distribution decision

The first Android QA build is consumption-only: free features and existing account entitlements; no checkout or payment portal inside the Android flow. Ordinary web billing remains unchanged. `distribution=google-play` and the same-tab session marker only select UI presentation. They never grant access or change Supabase auth, subscription rows, RLS, or server premium checks. A user changing the marker does not become Premium. Play Billing products, purchase-token verification, refunds and subscription lifecycle sync remain future implementation work if Android purchases are required.

The launcher appends the marker on every launch and incoming deep link, preserves auth query/hash data, and rejects external origins. No native microphone, camera, notifications or payment capabilities are claimed. Existing browser-supported voice must be checked on the actual Android browser/device.

## Local build

Requires JDK 17, Android SDK platform 36, build-tools 35.0.0, and Gradle 8.13. Android Gradle Plugin is pinned to 8.13.2 and Android Browser Helper to 2.7.3.

Set JAVA_HOME and ANDROID_HOME, then run from this directory:

```powershell
.\gradlew.bat :app:assembleDebug :app:lintDebug
```

Default debug identity is `com.cheffodoggo.unregistered.qa`. It is explicitly a QA placeholder, not a chosen production package. App name is “Cheffo Doggo QA”. Use `-PCHEFFO_ORIGIN=https://your-verified-preview-host` to test an already deployed HTTPS preview of these changes. The default is https://cheffodoggo.com. Never assume that the deployed website includes this checkout's fixes.

## Release gates

1. The owner verified no Cheffo app exists in the signed-in RecipeReborn Play Console account and selected `com.cheffodoggo.app`. Prepared values are in `production/`; registration, signing and store setup remain pending. The default QA identity is unchanged. Recheck the account before any first upload, and preserve any identity/version/signing established by root.
2. Deploy and verify the web changes on the selected origin: Android welcome, account access, help/legal, payment failure banner, upgrade modal, direct pricing navigation, sign-in/sign-up/reset redirects, and reloads. Purchases must remain unavailable throughout the Android flow; ordinary browser checkout should still work.
3. Configure the real upload key/Play App Signing identity. No release signing key is created, copied from Recipe Reborn, or committed here. Release build tasks are blocked until `CHEFFO_APPLICATION_ID` and `CHEFFO_RELEASE_READY=true` are explicitly supplied. That flag is an operator check, not proof that tests passed. Configure signing separately and increase `CHEFFO_VERSION_CODE` above the current store artifact.
4. Publish `/.well-known/assetlinks.json` for the exact app package and SHA-256 certificate of the installed artifact. Internal testing through Play uses the Play app-signing certificate; local debug uses its debug certificate and QA-suffixed ID. Include each real certificate explicitly. No fake fingerprint or placeholder public assetlinks file is shipped. Unverified TWA origins fall back to browser Custom Tabs with a visible address bar.
5. Test fresh install, existing login, new account, free allowance, paid-existing access, profiles, meal/treat generation, ingredient restrictions, saved recipe changes/deletion, calculator, shopping/print/vet exports, account export/delete, navigation/back, sign-out, offline first launch, cached reload, reconnect, and supported voice on physical Android. Cloud data is not promised offline. The native offline screen offers retry or trying previously loaded pages; the PWA precaches shell assets, not authenticated cloud records.
6. Complete store listing/screenshots, privacy and Data Safety answers, app access reviewer credentials, content rating, any applicable testing requirements, and prelaunch reports. A successful local APK build is not Google Play approval or end-to-end readiness.

## Sources verified 2026-09-23

- [Chrome TWA quick start](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start)
- [Google Android Browser Helper](https://github.com/GoogleChrome/android-browser-helper)
- [AGP 8.13 compatibility](https://developer.android.com/build/releases/agp-8-13-0-release-notes)
- [Google Play payment FAQ: consumption-only apps](https://support.google.com/googleplay/android-developer/answer/10281818?hl=en)

Evidence from this work is stored outside the repository in the task's `cheffo-android-readiness` visualization folder. Local browser checks disable Supabase and block nonlocalhost traffic; they do not certify real auth, billing, data deletion, or physical-device behavior.
