# iOS native integration status

This folder contains the Capacitor 7 app scaffold, a registered `KakeiboDevice` Capacitor plugin, and WidgetKit source. Swift compilation, simulator/device launch, and code signing have not been run: this work was prepared on Windows without Xcode or a Mac.

## Included

- `App/App/BridgeViewController.swift` registers `KakeiboDevicePlugin` in `capacitorDidLoad()`. `Main.storyboard` uses that controller.
- `App/App/KakeiboDevicePlugin.swift` implements `setOwner`, `updateWidget`, `setWidgetPrivacy`, `getWidgetSettings`, `clearPrivateData`, and `notificationCommand`. `readOtherAppNotifications` rejects with an explicit unsupported-capability error because iOS does not expose other apps' notifications.
- `App/App/App.entitlements` grants the app group `group.com.kakeibodata.kakeibo.nativeapp`; the app target points at this entitlement file.
- `Widget/KakeiboWidget.swift` is the WidgetKit extension source. It reads the shared snapshot, offers small and medium widgets, displays the month total and next withdrawal, labels stale/offline/error and month-mismatch data, masks amounts by default, and opens `kakeibo-native://add-expense`.
- `App/App/Info.plist` declares the `kakeibo-native` URL scheme.

The shared JSON snapshot is written atomically in the App Group container with `NSFileProtectionComplete`. Money values are not stored in `UserDefaults`; the shared defaults suite only stores the `showAmounts` privacy preference, which defaults to false and is reset on owner change/logout. Amounts remain masked when the snapshot is stale or belongs to a different month. WidgetKit can refresh on its own schedule, so a one-hour timeline request is not a freshness guarantee. The app should call `updateWidget` after a successful data refresh. `.privacySensitive()` asks iOS to redact the widget in privacy-sensitive contexts, but the extension cannot force an immediate timeline refresh or guarantee that every previously cached rendered view is purged as the device locks; keep amount visibility opted out for strict privacy.

## Required on a Mac with Xcode

1. Open `App/App.xcodeproj` and set the development team and signing identity. Register the App Group `group.com.kakeibodata.kakeibo.nativeapp` for the app identifier and enable the same App Group for the app and widget extension targets.
2. Add a Widget Extension target named `KakeiboWidgetExtension`, using `Widget/KakeiboWidget.swift` as its source and a bundle identifier under the app's team. Add WidgetKit and SwiftUI through the normal Xcode target template. Set the extension deployment target to iOS 14 or newer.
3. Give the extension the same App Group entitlement. Add the widget Swift file to the extension target only; keep the app plugin and `BridgeViewController.swift` in the app target.
4. Run `npx cap sync ios`, resolve CocoaPods in Xcode/macOS, build for an iOS simulator, then install on a device to verify app-group access, widget refresh, owner switching/logout clearing, privacy masking, and the add-expense deep link.
5. Verify the existing shared `NativeIntegration` router on iOS: `kakeibo-native://add-expense` opens the expense form and `kakeibo-native://auth?id=...` completes the pending PKCE request. Scheme delivery and screen restoration require device testing.

Do not claim the widget is installed or signed until those Xcode steps and device checks pass. APNs requires an enrolled Apple developer team and server-side token flow; this source does not invent or configure an APNs token. Native local reminders can use the official Capacitor local notifications plugin. Neither local notifications nor APNs can read notifications posted by other apps on iOS.

## JavaScript contract

- `setOwner({ owner })`: pass the authenticated owner's stable ID. Pass `""` on logout. A changed owner or logout clears the previous widget snapshot, resets amount visibility to hidden, and requests a timeline reload.
- `updateWidget({ owner, monthTotal, nextDate, nextAmount, updatedAt, lastSync, state, monthKey })`: pass values derived from the app's existing data; amounts are safe nonnegative integers, `updatedAt` and `lastSync` are Unix millisecond timestamps (`updatedAt` positive, `lastSync` nonnegative), and non-null `nextDate` is a positive Unix millisecond timestamp before 2100. All numeric fields must be safe integers. `nextDate` may be `null`, `state` is `current`, `offline`, or `error`, and `monthKey` must be a real month in `YYYY-MM` form.
- `setWidgetPrivacy({ showAmounts })` / `getWidgetSettings()`: control/read amount visibility. Initial state is hidden.
- `clearPrivateData()`: delete the shared snapshot, clear the active in-memory owner, and reset amount visibility to hidden.
- `notificationCommand({ command: "status" })`: returns `{ available: false, enabled: false, permissionGranted: false, pendingCount: 0 }`. `appearance` is accepted as a no-op for cross-platform compatibility. Commands that would request, read, acknowledge, enable, disable, or open settings for other-app notifications reject with `UNSUPPORTED_IOS_CAPABILITY`.
- `readOtherAppNotifications()`: always rejects with `UNSUPPORTED_IOS_CAPABILITY`.
