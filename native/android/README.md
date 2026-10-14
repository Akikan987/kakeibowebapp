# Kakeibo Android shell (debug build)

This is a small Android WebView shell for `https://app.kakeibodata.com/`. It is not a Play Store release. It asks Android for notification-listener access only after the user requests the feature and accepts the in-app disclosure.

## Build

Requirements: JDK 17, Android SDK platform 35 and build tools 34.0.0 or newer, and Android Gradle Plugin's pinned Gradle 8.9 distribution. The project uses AGP 8.7.3 and AndroidX WebKit 1.12.1. AGP 8.7 requires Gradle 8.9 and JDK 17; see [AGP 8.7 compatibility](https://developer.android.com/build/releases/agp-8-7-0-release-notes).

On the configured Windows machine, set the local JDK and SDK paths, then use the project Gradle wrapper to test, lint, and build the debug APK:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot'
$env:ANDROID_HOME = 'C:\Users\naito\AppData\Local\Android\Sdk'
.\gradlew.bat --no-daemon --gradle-user-home .gradle-user-home --project-cache-dir .gradle-project-cache testDebugUnitTest lintDebug assembleDebug
```

The output is `app/build/outputs/apk/debug/app-debug.apk`. On the first build Gradle creates the conventional debug-only signing key under the ignored `.debug/` directory. No release signing key is included or generated. Gradle's 8.9 distribution checksum (`d725d707bfabd4dfdc958c624003b3c80accc03f7037b5122c4b1d0ef15cecab`) is pinned in `gradle-wrapper.properties` and matches Gradle's [official checksum](https://services.gradle.org/distributions/gradle-8.9-bin.zip.sha256). The checked-in wrapper JAR checksum (`498495120a03b9a6ab5d155f5de3c8f0d986a449153702fb80fc80e134484f17`) matches Gradle's [official 8.9 wrapper JAR checksum](https://services.gradle.org/distributions/gradle-8.9-wrapper.jar.sha256).

This pilot intentionally targets API 35 and pins AndroidX WebKit 1.12.1. Lint reports the target SDK as older than the newest available target and reports a newer WebKit dependency; these two warnings are intentional pilot pins, not Play Store readiness. Before any production distribution, update and validate target SDK, WebKit, Android policy requirements, and supported devices. A successful debug build does not imply Play policy approval.

Latest local verification: four unit tests passed across the transaction-notification filter and accepted-file-type mapping. `lintDebug` completed with only the two intentional pilot warnings above. The debug APK was verified with Android's APK signer; it is signed with a local debug key only.

## Web/native bridge

The AndroidX WebKit `addWebMessageListener` API injects `window.KakeiboNative` only for the exact `https://app.kakeibodata.com` origin. The native side also checks the source origin, main-frame status, and currently loaded WebView origin. No `addJavascriptInterface` is used. See the [WebViewCompat API](https://developer.android.com/reference/androidx/webkit/WebViewCompat#addWebMessageListener(android.webkit.WebView,java.lang.String,java.util.Set,androidx.webkit.WebViewCompat.WebMessageListener)).

Requests are JSON strings posted by the page:

```json
{"version":1,"command":"status","requestId":"unique-page-request-id"}
```

Each reply is posted to that request's reply proxy:

```json
{"version":1,"requestId":"unique-page-request-id","result":{"available":true,"enabled":false,"permissionGranted":false,"pendingCount":0}}
```

Supported commands: `status`, `appearance` (`{"dark":true}`), `enable`, `disable`, `openNotificationSettings`, `readPending`, and `ack` (`{"ids":["opaque-event-id"]}`). `appearance` updates native system-bar and offline-panel colors to match the web theme (`#101418` dark, `#F5F5F7` light). `enable` always shows a native consent dialog. `readPending` returns only queued transaction-like notices, only while consent and Android notification access are active. The web page must call it after the user's explicit read action and should acknowledge only events it has successfully handled. `disable` immediately turns collection off and clears queued data and its encryption key.

## Collection and privacy boundaries

- Collection is off by default and uses Android's system `NotificationListenerService`; it does not run a separate boot receiver or polling service.
- Sender packages are limited to `jp.co.smbc.direct` and `com.smbc_card.vpass`. The filter requires an amount and a transaction-related term, and rejects login, password, identity-verification, and one-time-code language. This is a best-effort text filter, not a bank-certified transaction parser.
- Event payloads are encrypted individually with AES-GCM using a non-exportable Android Keystore key. The private app store retains at most 50 events for seven days. Titles are capped at 256 characters and bodies at 2,000. App backup is disabled; Android cloud backup and device transfer explicitly exclude app data. Disabling capture deletes the store and key.
- Native collection has no network or upload code. The bridge reveals queued content only on an explicit `readPending` call. The web app controls any later registration or synchronization and must explain that separately.
- No notification text is written to logs. This shell does not accept browser URLs as launch parameters, allow cleartext traffic, or expose app files to web content. TLS errors are cancelled. Other web origins and social-provider navigation open in the external browser; Google and LINE OAuth session sharing with the WebView is not promised.
- Receipt/image inputs use Android's system document picker (`ACTION_OPEN_DOCUMENT`), with no broad storage permission. Accepted filename extensions are mapped only to a small known MIME allowlist; extension strings are never passed to Android as MIME filters.
- First-party cookies are accepted, third-party cookies are disabled, and cookies are flushed when the activity pauses. The WebView cookie store is separate from Chrome/PWA; live sign-in still requires physical-device validation.
- Back delegates to the WebView history. This preserves the web app's existing bounded double-back behavior; physical-device behavior still needs device validation.

The bridge is a narrow local interface, but a compromised script delivered by the trusted app origin can call any bridge command. Keep the production site protected against script injection and only load trusted resources.
