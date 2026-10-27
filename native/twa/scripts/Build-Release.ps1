[CmdletBinding()]
param(
    [string]$JavaHome = $env:JAVA_HOME,
    [string]$AndroidHome = $env:ANDROID_HOME,
    [switch]$InitializeSigning,
    [switch]$PublishFiles
)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$webRoot = (Resolve-Path (Join-Path $projectRoot '../..')).Path
if (!$JavaHome) { throw 'Pass -JavaHome with an installed JDK 17 directory.' }
if (!$AndroidHome) { $AndroidHome = Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
$keytool = Join-Path $JavaHome 'bin/keytool.exe'
$signer = Join-Path $AndroidHome 'build-tools/35.0.0/apksigner.bat'
foreach ($tool in @($keytool, $signer)) { if (!(Test-Path -LiteralPath $tool)) { throw "Required tool missing: $tool" } }
$release = Get-Content -LiteralPath (Join-Path $projectRoot 'release.json') -Raw | ConvertFrom-Json
if ($release.applicationId -ne 'com.kakeibodata.kakeibo.app' -or $release.origin -ne 'https://app.kakeibodata.com' -or $release.versionName -notmatch '^\d+\.\d+\.\d+$') { throw 'Unexpected release identity.' }
$signingDir = Join-Path $projectRoot '.signing'
$keyFile = Join-Path $signingDir 'kakeibo-release.p12'
$passwordFile = Join-Path $signingDir 'password.dpapi'
& git -C $webRoot check-ignore --quiet 'native/twa/.signing/kakeibo-release.p12'
if ($LASTEXITCODE -ne 0) { throw 'Signing directory must be ignored by Git before creating a key.' }
Add-Type -AssemblyName System.Security
$envNames = @('JAVA_HOME', 'ANDROID_HOME', 'KAKEIBO_ANDROID_STORE_FILE', 'KAKEIBO_ANDROID_STORE_PASSWORD')
$previous = @{}
foreach ($envName in $envNames) { $previous[$envName] = [Environment]::GetEnvironmentVariable($envName, 'Process') }
$clearBytes = $null
try {
    $env:JAVA_HOME = $JavaHome
    $env:ANDROID_HOME = $AndroidHome
    $env:KAKEIBO_ANDROID_STORE_FILE = $keyFile
    if (!(Test-Path -LiteralPath $keyFile) -and !(Test-Path -LiteralPath $passwordFile)) {
        if (!$InitializeSigning) { throw 'Signing key not initialized. Explicitly use -InitializeSigning once.' }
        if (Test-Path -LiteralPath $signingDir) { throw 'Signing folder already exists. Inspect it manually; never overwrite a signing identity.' }
        New-Item -ItemType Directory -Path $signingDir | Out-Null
        $acl = New-Object System.Security.AccessControl.DirectorySecurity
        $acl.SetAccessRuleProtection($true, $false)
        $owner = [Security.Principal.WindowsIdentity]::GetCurrent().User
        $acl.SetOwner($owner)
        foreach ($identity in @($owner, (New-Object Security.Principal.SecurityIdentifier 'S-1-5-18'))) {
            $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
        }
        Set-Acl -LiteralPath $signingDir -AclObject $acl
        $random = New-Object byte[] 32
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($random) } finally { $rng.Dispose() }
        $env:KAKEIBO_ANDROID_STORE_PASSWORD = [Convert]::ToBase64String($random)
        [Array]::Clear($random, 0, $random.Length)
        $clearBytes = [Text.Encoding]::UTF8.GetBytes($env:KAKEIBO_ANDROID_STORE_PASSWORD)
        $protected = [Security.Cryptography.ProtectedData]::Protect($clearBytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
        [IO.File]::WriteAllBytes($passwordFile, $protected)
        & $keytool -genkeypair -keystore $keyFile -storetype PKCS12 -storepass:env KAKEIBO_ANDROID_STORE_PASSWORD -keypass:env KAKEIBO_ANDROID_STORE_PASSWORD -alias kakeibo-release -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Kakeibo,O=Akikan,C=JP'
        if ($LASTEXITCODE -ne 0) { throw 'Key generation failed; preserve the signing folder for inspection.' }
        Write-Output 'Created a private release signing identity (not a debug key).'
    } else {
        if (!(Test-Path -LiteralPath $keyFile) -or !(Test-Path -LiteralPath $passwordFile)) { throw 'Incomplete signing files. Do not regenerate or overwrite them.' }
        $clearBytes = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($passwordFile), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
        $env:KAKEIBO_ANDROID_STORE_PASSWORD = [Text.Encoding]::UTF8.GetString($clearBytes)
    }
    $certificate = Join-Path $signingDir 'certificate.der'
    & $keytool -exportcert -keystore $keyFile -storepass:env KAKEIBO_ANDROID_STORE_PASSWORD -alias kakeibo-release -file $certificate
    if ($LASTEXITCODE -ne 0) { throw 'Could not read the signing certificate.' }
    $certificateHash = (Get-FileHash -LiteralPath $certificate -Algorithm SHA256).Hash.ToLowerInvariant()
    $fingerprint = ($certificateHash.ToUpperInvariant() -replace '(..)(?!$)', '$1:')
    Push-Location $projectRoot
    try {
        & './gradlew.bat' --no-daemon --gradle-user-home .gradle-user-home --project-cache-dir .gradle-project-cache testReleaseUnitTest lintRelease assembleRelease bundleRelease
        if ($LASTEXITCODE -ne 0) { throw 'Android tests, lint or release build failed.' }
    } finally { Pop-Location }
    $apk = Join-Path $projectRoot 'app/build/outputs/apk/release/app-release.apk'
    $verification = (& $signer verify --verbose --print-certs $apk | Out-String)
    if ($LASTEXITCODE -ne 0 -or $verification -notmatch [regex]::Escape($certificateHash)) { throw 'APK signature/certificate verification failed.' }
    if ($verification -match 'CN=Android Debug') { throw 'Refusing to distribute a debug APK.' }
    $apkHash = (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLowerInvariant()
    $fileName = 'kakeibo-android-' + $release.versionName + '.apk'
    $outDir = Join-Path $projectRoot 'releases'
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
    Copy-Item -LiteralPath $apk -Destination (Join-Path $outDir $fileName) -Force
    Copy-Item -LiteralPath (Join-Path $projectRoot 'app/build/outputs/bundle/release/app-release.aab') -Destination (Join-Path $outDir ('kakeibo-android-' + $release.versionName + '.aab')) -Force
    if ($PublishFiles) {
        $downloadDir = Join-Path $webRoot 'public/pr/downloads'
        $associationDir = Join-Path $webRoot 'public/.well-known'
        New-Item -ItemType Directory -Path $downloadDir, $associationDir -Force | Out-Null
        Copy-Item -LiteralPath $apk -Destination (Join-Path $downloadDir $fileName) -Force
        $association = @(@{ relation = @('delegate_permission/common.handle_all_urls'); target = @{ namespace = 'android_app'; package_name = $release.applicationId; sha256_cert_fingerprints = @($fingerprint) } })
        $metadata = @{ versionName = $release.versionName; versionCode = $release.versionCode; packageName = $release.applicationId; minAndroid = '8.0'; file = $fileName; sha256 = $apkHash; certificateSha256 = $fingerprint; bytes = (Get-Item -LiteralPath $apk).Length; buildDate = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ'); mode = 'trusted-web-activity' }
        $utf8 = New-Object Text.UTF8Encoding($false)
        [IO.File]::WriteAllText((Join-Path $associationDir 'assetlinks.json'), (ConvertTo-Json -InputObject $association -Depth 6), $utf8)
        [IO.File]::WriteAllText((Join-Path $downloadDir 'android-release.json'), (ConvertTo-Json -InputObject $metadata -Depth 4), $utf8)
        Write-Output 'Prepared public APK, checksums and website association; no private key is copied.'
    }
    Write-Output ('Verified release APK: ' + (Join-Path $outDir $fileName))
    Write-Output ('APK SHA256: ' + $apkHash)
    Write-Output ('Public signing certificate SHA256: ' + $fingerprint)
} finally {
    if ($clearBytes) { [Array]::Clear($clearBytes, 0, $clearBytes.Length) }
    foreach ($envName in $envNames) { [Environment]::SetEnvironmentVariable($envName, $previous[$envName], 'Process') }
}
