import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const release = JSON.parse(source('native/twa/release.json'))
const metadata = JSON.parse(source('public/pr/downloads/android-release.json'))

test('インストール版は旧WebViewと別パッケージで現行HTTPSサイトを使う', () => {
  assert.equal(release.applicationId, 'com.kakeibodata.kakeibo.app')
  assert.equal(release.origin, 'https://app.kakeibodata.com')
  assert.ok(release.minSdk >= 26)
  assert.ok(release.targetSdk >= 36)
  assert.match(source('native/android/app/build.gradle'), /applicationId "com.kakeibodata.kakeibo"/)
  assert.equal(metadata.packageName, release.applicationId)
  assert.equal(metadata.versionName, release.versionName)
  assert.equal(metadata.versionCode, release.versionCode)
})

test('TWAを使い通知読み取りや広範なストレージ権限を要求しない', () => {
  const activity = source('native/twa/app/src/main/java/com/kakeibodata/kakeibo/app/MainActivity.java')
  assert.match(activity, /extends LauncherActivity/)
  assert.doesNotMatch(activity, /addJavascriptInterface|WebView|Log\./)
  const manifest = source('native/twa/app/src/main/AndroidManifest.xml')
  assert.match(manifest, /android:usesCleartextTraffic="false"/)
  assert.match(manifest, /android:allowBackup="false"/)
  assert.match(manifest, /android.permission.POST_NOTIFICATIONS/)
  assert.match(manifest, /NotificationPermissionRequestActivity" android:exported="false"/)
  assert.match(manifest, /android:host="app.kakeibodata.com" android:path="\/"/)
  assert.doesNotMatch(manifest, /BankNotificationListener|BIND_NOTIFICATION_LISTENER_SERVICE|READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE/)
})

test('Digital Asset Linksはrelease証明書と正確なパッケージ1件だけ', () => {
  const associations = JSON.parse(source('public/.well-known/assetlinks.json'))
  assert.equal(associations.length, 1)
  assert.deepEqual(associations[0].relation, ['delegate_permission/common.handle_all_urls'])
  assert.equal(associations[0].target.namespace, 'android_app')
  assert.equal(associations[0].target.package_name, release.applicationId)
  assert.deepEqual(associations[0].target.sha256_cert_fingerprints, [metadata.certificateSha256])
  assert.match(metadata.certificateSha256, /^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/)
  assert.match(metadata.sha256, /^[a-f0-9]{64}$/)
})

test('ダウンロードと関連付けはSPA・Service WorkerのHTMLフォールバック対象外', () => {
  const config = source('vite.config.ts')
  assert.match(config, /'downloads\/\*\*\/\*'/)
  assert.ok(config.includes('/^\\/(?:downloads|\\.well-known)(?:\\/|$)/'))
  const nginx = source('nginx.conf')
  assert.match(nginx, /location = \/\.well-known\/assetlinks\.json \{[^}]*try_files \$uri =404;/s)
  assert.match(nginx, /application\/vnd\.android\.package-archive apk/)
  assert.match(nginx, /location \^~ \/pr\/downloads\//)
  assert.match(source('Dockerfile'), /RUN node scripts\/verify-android-release\.mjs --public-only/)
})

test('署名鍵とパスワードは非公開・既存の署名を無断で上書きしない', () => {
  assert.match(source('native/twa/.gitignore'), /\.signing\//)
  assert.match(source('.dockerignore'), /native\//)
  const script = source('native/twa/scripts/Build-Release.ps1')
  assert.match(script, /ProtectedData\]::Protect/)
  assert.match(script, /DataProtectionScope\]::CurrentUser/)
  assert.match(script, /-storepass:env KAKEIBO_ANDROID_STORE_PASSWORD/)
  assert.match(script, /if \(!\$InitializeSigning\)/)
  assert.match(script, /Signing folder already exists/)
  assert.match(script, /SetAccessRuleProtection\(\$true, \$false\)/)
  assert.match(script, /SetEnvironmentVariable\(\$envName, \$previous\[\$envName\], 'Process'\)/)
  assert.doesNotMatch(script, /Write-Output[^\n]*\$env:KAKEIBO_ANDROID_STORE_PASSWORD/)
})

test('既存PWA導線を残し、APKの制限と安全な切り替えを案内する', () => {
  const guide = source('public/pr/install.html')
  assert.match(guide, /id="android-apk"/)
  assert.ok(guide.includes(`/pr/downloads/${metadata.file}`))
  assert.equal((guide.match(/class="step-number"/g) ?? []).length, 8)
  assert.equal((guide.match(/role="img"/g) ?? []).length, 8)
  assert.ok(guide.includes('Google Play'))
  assert.ok(guide.includes('iPhone'))
  assert.ok(guide.includes('ウィジェット'))
})
