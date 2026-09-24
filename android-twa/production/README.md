# Production Android candidate

Selected package: `com.cheffodoggo.app`. Current candidate: versionCode `2`, versionName `0.1.0`, target SDK `36`, minimum SDK `26`, origin `https://cheffodoggo.com`. Code 1 is superseded after a physical-device launch exposed a missing Android Browser Helper activity declaration; it was never uploaded. Code 2 registers that non-exported component and its website-settings metadata. The coordinator confirmed a draft Play app with no uploaded release. Recheck that state before first upload; a later artifact requires a higher code.

The dedicated local upload keystore and DPAPI-protected password are under `%LOCALAPPDATA%\CheffoDoggo\Signing`, outside source control and OneDrive. Directory permissions allow only the current Windows user and SYSTEM. No plaintext signing password is stored in project configuration. Do not regenerate or overwrite this key when troubleshooting.

Set `JAVA_HOME` to JDK 17, `ANDROID_HOME` to the installed SDK, and optionally the existing `GRADLE_USER_HOME`. From `android-twa/`:

```powershell
.\production\build-signed.ps1 -VersionCode 2 -Artifact both
```

This reads the existing Windows-protected credential, sets `CHEFFO_UPLOAD_STORE_FILE`, `CHEFFO_UPLOAD_STORE_PASSWORD`, `CHEFFO_UPLOAD_KEY_ALIAS`, and `CHEFFO_UPLOAD_KEY_PASSWORD` only for the build, then clears them. Gradle uses a single-use daemon. Output: `app/build/outputs/bundle/release/app-release.aab` and `app/build/outputs/apk/release/app-release.apk`. The APK is a temporary sideload QA candidate with the production package and upload certificate. The default debug ID remains `com.cheffodoggo.unregistered.qa`.

Upload certificate SHA-256: `9E:41:E3:EE:83:E7:94:9F:57:68:F4:56:BF:CC:76:14:F0:4C:0C:41:97:00:71:90:8C:0A:06:7E:D0:8A:62:A2`. This certificate expires in February 2054. It is **not** the as-yet-unconfigured Google Play app-signing certificate.

The local build flag does not authorize uploading, accepting terms or publishing. Play App Signing selection, Digital Asset Links with the actual Play certificate, current website verification, physical Android QA and store forms remain required. A Play-signed app normally cannot update over this differently signed sideload; do not uninstall an existing app without accounting for its user data.

No portable recovery backup was created. DPAPI data is tied to the current Windows account. Before long-term release, the owner must retain and verify a separate encrypted backup of the keystore and recoverable password in an owner-selected secure location. Never place the key/password in Git, email, screenshots or plaintext logs. The public certificate can be shared; the private key cannot.

Sources: [Android app signing](https://developer.android.com/studio/publish/app-signing), [Trusted Web Activity verification](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start).
