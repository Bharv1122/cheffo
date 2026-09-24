# Prepared production identity

On 2026-09-23 the owner selected `com.cheffodoggo.app` after the signed-in RecipeReborn Play Console account was verified to contain only two Recipe Reborn apps. This local preparation does not register a package or create a store listing.

`gradle.properties` here records the selected values separately from the default QA configuration. It contains no key, certificate or authorization to release. The existing QA APK remains `com.cheffodoggo.unregistered.qa` and its default build is unchanged.

When root has completed registration, signing, Digital Asset Links, deployment and device checks, pass these values explicitly from `android-twa/`:

```powershell
.\gradlew.bat :app:bundleRelease -PCHEFFO_APPLICATION_ID=com.cheffodoggo.app -PCHEFFO_ORIGIN=https://cheffodoggo.com -PCHEFFO_VERSION_CODE=1 -PCHEFFO_RELEASE_READY=true
```

The command above is a future release command, not a completed step. It still requires an upload signing configuration. No signing key was generated and no release bundle was built or uploaded. If any version has since been uploaded, choose a higher versionCode. The readiness flag is an operator assertion, not automatic certification. Keep actual signing values out of source control.

The production domain association must use `com.cheffodoggo.app` and the actual Play App Signing certificate SHA-256. Do not publish the QA debug fingerprint for the production package.
