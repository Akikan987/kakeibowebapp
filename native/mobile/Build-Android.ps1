[CmdletBinding()]
param(
    [string]$JavaHome,
    [string]$AndroidHome = 'C:\Users\naito\AppData\Local\Android\Sdk',
    [switch]$InitializeSigning
)
$ErrorActionPreference = 'Stop'
$mobileRoot = $PSScriptRoot
$webRoot = (Resolve-Path (Join-Path $mobileRoot '../..')).Path
$release = Get-Content -LiteralPath (Join-Path $mobileRoot 'release.json') -Raw | ConvertFrom-Json
if ($release.applicationId -ne 'com.kakeibodata.kakeibo.nativeapp' -or $release.versionName -notmatch '^\d+\.\d+\.\d+$') { throw 'Unexpected release identity.' }
if (!$JavaHome) {
    $bundledJdk = Get-ChildItem (Join-Path $mobileRoot '.tooling') -Directory -Filter 'jdk-21*' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($bundledJdk) { $JavaHome = $bundledJdk.FullName } else { $JavaHome = $env:JAVA_HOME }
}
$keytool = Join-Path $JavaHome 'bin/keytool.exe'
$signer = Join-Path $AndroidHome 'build-tools/35.0.0/apksigner.bat'
foreach ($tool in @($keytool, $signer)) { if (!(Test-Path -LiteralPath $tool)) { throw "Missing tool: $tool" } }
$signing = Join-Path $mobileRoot '.signing'
$keyFile = Join-Path $signing 'native-release.p12'
$passwordFile = Join-Path $signing 'password.dpapi'
& git -C $webRoot check-ignore --quiet 'native/mobile/.signing/native-release.p12'
if ($LASTEXITCODE -ne 0) { throw 'Signing files must be excluded from Git.' }
Add-Type -AssemblyName System.Security
$names = @('JAVA_HOME', 'ANDROID_HOME', 'KAKEIBO_NATIVE_STORE_FILE', 'KAKEIBO_NATIVE_STORE_PASSWORD')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$clear = $null
try {
    $env:JAVA_HOME = $JavaHome
    $env:ANDROID_HOME = $AndroidHome
    $env:KAKEIBO_NATIVE_STORE_FILE = $keyFile
    if (!(Test-Path -LiteralPath $keyFile) -and !(Test-Path -LiteralPath $passwordFile)) {
        if (!$InitializeSigning) { throw 'Use -InitializeSigning once for this separate application.' }
        if (Test-Path -LiteralPath $signing) { throw 'Signing folder exists; never replace an identity automatically.' }
        New-Item -ItemType Directory -Path $signing | Out-Null
        $acl = New-Object System.Security.AccessControl.DirectorySecurity
        $acl.SetAccessRuleProtection($true, $false)
        $owner = [Security.Principal.WindowsIdentity]::GetCurrent().User
        $acl.SetOwner($owner)
        foreach ($identity in @($owner, (New-Object Security.Principal.SecurityIdentifier 'S-1-5-18'))) {
            $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
        }
        Set-Acl -LiteralPath $signing -AclObject $acl
        $bytes = New-Object byte[] 32
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
        $env:KAKEIBO_NATIVE_STORE_PASSWORD = [Convert]::ToBase64String($bytes)
        [Array]::Clear($bytes, 0, $bytes.Length)
        $clear = [Text.Encoding]::UTF8.GetBytes($env:KAKEIBO_NATIVE_STORE_PASSWORD)
        [IO.File]::WriteAllBytes($passwordFile, [Security.Cryptography.ProtectedData]::Protect($clear, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser))
        & $keytool -genkeypair -keystore $keyFile -storetype PKCS12 -storepass:env KAKEIBO_NATIVE_STORE_PASSWORD -keypass:env KAKEIBO_NATIVE_STORE_PASSWORD -alias kakeibo-native-release -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Kakeibo Native,O=Akikan,C=JP'
        if ($LASTEXITCODE -ne 0) { throw 'Key generation failed. Preserve files for inspection.' }
    } else {
        if (!(Test-Path -LiteralPath $keyFile) -or !(Test-Path -LiteralPath $passwordFile)) { throw 'Incomplete signing identity; do not regenerate.' }
        $clear = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($passwordFile), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
        $env:KAKEIBO_NATIVE_STORE_PASSWORD = [Text.Encoding]::UTF8.GetString($clear)
    }
    Push-Location $webRoot
    try { & npm run native:sync; if ($LASTEXITCODE -ne 0) { throw 'Native bundle/sync failed.' } } finally { Pop-Location }
    Push-Location (Join-Path $mobileRoot 'android')
    try {
        & './gradlew.bat' --no-daemon --gradle-user-home ../.gradle-user-home --project-cache-dir ../.gradle-project-cache testReleaseUnitTest lintRelease assembleRelease
        if ($LASTEXITCODE -ne 0) { throw 'Android tests/lint/build failed.' }
    } finally { Pop-Location }
    $apk = Join-Path $mobileRoot 'android/app/build/outputs/apk/release/app-release.apk'
    $cert = Join-Path $signing 'certificate.der'
    & $keytool -exportcert -keystore $keyFile -storepass:env KAKEIBO_NATIVE_STORE_PASSWORD -alias kakeibo-native-release -file $cert
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read signing certificate.' }
    $certHash = (Get-FileHash -LiteralPath $cert -Algorithm SHA256).Hash.ToLowerInvariant()
    $verification = (& $signer verify --verbose --print-certs $apk | Out-String)
    if ($LASTEXITCODE -ne 0 -or $verification -notmatch [regex]::Escape($certHash) -or $verification -match 'CN=Android Debug') { throw 'APK signature/certificate verification failed.' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead($apk)
    try {
        if ($archive.Entries | Where-Object { $_.FullName -match '(?i)(\.dpapi$|\.p12$|\.jks$|\.keystore$|(^|/)\.env($|\.))' }) { throw 'Unexpected private material in APK.' }
    } finally { $archive.Dispose() }
    $outDir = Join-Path $mobileRoot 'releases'
    New-Item -ItemType Directory -Force $outDir | Out-Null
    $fileName = 'kakeibo-native-' + $release.versionName + '.apk'
    $target = Join-Path $outDir $fileName
    Copy-Item -LiteralPath $apk -Destination $target -Force
    $metadata = @{ file = $fileName; applicationId = $release.applicationId; versionName = $release.versionName; versionCode = $release.versionCode; certificateSha256 = $certHash; sha256 = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant(); bytes = (Get-Item -LiteralPath $target).Length; builtAt = [DateTime]::UtcNow.ToString('o'); deviceVerified = $false }
    [IO.File]::WriteAllText((Join-Path $outDir 'release.json'), ($metadata | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
    Write-Output "Verified APK: $target"
    Write-Output ('SHA256: ' + $metadata.sha256)
} finally {
    if ($clear) { [Array]::Clear($clear, 0, $clear.Length) }
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
