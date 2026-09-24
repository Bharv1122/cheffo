param(
  [ValidateRange(1,2147483647)][int]$VersionCode=2,
  [ValidateSet('bundle','qa-apk','both')][string]$Artifact='both'
)
$ErrorActionPreference='Stop'
$signingDirectory=Join-Path $env:LOCALAPPDATA 'CheffoDoggo\Signing'
$descriptorPath=Join-Path $signingDirectory 'signing.private.json'
if (!(Test-Path -LiteralPath $descriptorPath)) { throw 'Cheffo upload signing is not initialized for this Windows user.' }
if (!$env:JAVA_HOME -or !(Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin\java.exe'))) { throw 'Set JAVA_HOME to JDK 17 first.' }
if (!$env:ANDROID_HOME -or !(Test-Path -LiteralPath $env:ANDROID_HOME)) { throw 'Set ANDROID_HOME to the installed Android SDK first.' }
$descriptor=Get-Content -LiteralPath $descriptorPath -Raw | ConvertFrom-Json
$ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
if ($descriptor.Package -ne 'com.cheffodoggo.app' -or $descriptor.OwnerSid -ne $ownerSid -or $descriptor.Alias -ne 'cheffo-upload') { throw 'Signing descriptor does not match this account and package.' }
if ($descriptor.KeystoreFile -ne 'com.cheffodoggo.app-upload.jks' -or $descriptor.ProtectedPasswordFile -ne 'upload-password.dpapi') { throw 'Unexpected signing file path; no credentials loaded.' }
$keystorePath=Join-Path $signingDirectory $descriptor.KeystoreFile
if (!(Test-Path -LiteralPath $keystorePath)) { throw 'Existing upload keystore is missing; do not generate a replacement blindly.' }
$securePassword=Get-Content -LiteralPath (Join-Path $signingDirectory $descriptor.ProtectedPasswordFile) -Raw | ConvertTo-SecureString
$bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  $env:CHEFFO_UPLOAD_STORE_FILE=$keystorePath
  $env:CHEFFO_UPLOAD_STORE_PASSWORD=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  $env:CHEFFO_UPLOAD_KEY_ALIAS=$descriptor.Alias
  $env:CHEFFO_UPLOAD_KEY_PASSWORD=$env:CHEFFO_UPLOAD_STORE_PASSWORD
  $tasks=switch($Artifact){'bundle'{@(':app:bundleRelease')};'qa-apk'{@(':app:assembleRelease')};default{@(':app:bundleRelease',':app:assembleRelease')}}
  # This approves a local signed candidate build only, not a Play upload or public rollout.
  $gradle=Join-Path (Split-Path $PSScriptRoot -Parent) 'gradlew.bat'
  Push-Location (Split-Path $PSScriptRoot -Parent)
  try {
    & $gradle @tasks --no-daemon '-PCHEFFO_APPLICATION_ID=com.cheffodoggo.app' '-PCHEFFO_ORIGIN=https://cheffodoggo.com' "-PCHEFFO_VERSION_CODE=$VersionCode" '-PCHEFFO_RELEASE_READY=true'
    if ($LASTEXITCODE -ne 0) { throw 'Signed Android candidate build failed.' }
  } finally { Pop-Location }
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  $securePassword.Dispose()
  foreach($name in @('CHEFFO_UPLOAD_STORE_FILE','CHEFFO_UPLOAD_STORE_PASSWORD','CHEFFO_UPLOAD_KEY_ALIAS','CHEFFO_UPLOAD_KEY_PASSWORD')) { Remove-Item "Env:$name" -ErrorAction SilentlyContinue }
}
