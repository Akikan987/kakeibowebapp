import Capacitor
import CoreFoundation
import Foundation
import CoreFoundation
import WidgetKit

@objc(KakeiboDevicePlugin)
public final class KakeiboDevicePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "KakeiboDevicePlugin"
    public let jsName = "KakeiboDevice"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setOwner", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateWidget", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setWidgetPrivacy", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getWidgetSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearPrivateData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "notificationCommand", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readOtherAppNotifications", returnType: CAPPluginReturnPromise),
    ]

    private let appGroup = "group.com.kakeibodata.kakeibo.nativeapp"
    private let snapshotFilename = "widget-snapshot.json"
    private let privacyKey = "kakeibo.widget.showAmounts"
    private var activeOwner: String?

    private var sharedDirectory: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)
    }

    @objc func setOwner(_ call: CAPPluginCall) {
        guard let owner = call.getString("owner") else {
            call.reject("owner must be a string; pass an empty string on logout")
            return
        }
        guard owner.range(of: #"^[A-Za-z0-9_-]{0,128}$"#, options: .regularExpression) != nil else {
            call.reject("owner contains unsupported characters")
            return
        }
        do {
            let snapshot = try readSnapshot()
            let newActiveOwner = owner.isEmpty ? nil : owner
            let ownerChanged = snapshot?.owner != owner || activeOwner != nil && activeOwner != newActiveOwner
            if ownerChanged {
                guard let defaults = UserDefaults(suiteName: appGroup) else { throw StorageError.appGroupUnavailable }
                try removeSnapshot()
                defaults.set(false, forKey: privacyKey)
                WidgetCenter.shared.reloadAllTimelines()
            }
            activeOwner = newActiveOwner
            call.resolve(["ok": true])
        } catch {
            call.reject("Could not switch widget owner", "WIDGET_STORAGE_ERROR", error)
        }
    }

    @objc func updateWidget(_ call: CAPPluginCall) {
        guard let owner = activeOwner, !owner.isEmpty else {
            call.reject("Call setOwner with the signed-in owner before updating the widget")
            return
        }
        guard call.getString("owner") == owner else {
            call.reject("updateWidget owner does not match the active owner")
            return
        }
        guard
            let monthTotal = safeInteger(call.getValue("monthTotal")), monthTotal >= 0,
            let nextAmount = safeInteger(call.getValue("nextAmount")), nextAmount >= 0,
            let updatedAt = safeInteger(call.getValue("updatedAt")), updatedAt > 0,
            let lastSync = safeInteger(call.getValue("lastSync")), lastSync >= 0,
            let state = call.getString("state"), ["current", "offline", "error"].contains(state),
            let monthKey = call.getString("monthKey"), monthKey.range(of: #"^[0-9]{4}-(0[1-9]|1[0-2])$"#, options: .regularExpression) != nil
        else {
            call.reject("Invalid widget snapshot fields")
            return
        }
        let now = Int64(Date().timeIntervalSince1970 * 1000)
        guard updatedAt <= now + 300_000, lastSync <= now + 300_000 else {
            call.reject("updatedAt and lastSync must not be in the future")
            return
        }
        guard let rawDate = call.getValue("nextDate") else {
            call.reject("nextDate is required and must be a timestamp or null")
            return
        }
        let nextDate: Int64?
        if !(rawDate is NSNull) {
            guard let date = safeInteger(rawDate), date > 0, date < 4_102_444_800_000 else {
                call.reject("nextDate must be a valid Unix millisecond timestamp or null")
                return
            }
            nextDate = date
        } else {
            nextDate = nil
        }

        let snapshot: [String: Any] = [
            "owner": owner,
            "monthTotal": monthTotal,
            "nextDate": nextDate.map { $0 as Any } ?? NSNull(),
            "nextAmount": nextAmount,
            "updatedAt": updatedAt,
            "lastSync": lastSync,
            "state": state,
            "monthKey": monthKey,
        ]
        do {
            guard let directory = sharedDirectory else { throw StorageError.appGroupUnavailable }
            let data = try JSONSerialization.data(withJSONObject: snapshot, options: [.sortedKeys])
            try data.write(to: directory.appendingPathComponent(snapshotFilename), options: [.atomic, .completeFileProtection])
            WidgetCenter.shared.reloadAllTimelines()
            call.resolve(["ok": true])
        } catch {
            call.reject("Could not save widget snapshot", "WIDGET_STORAGE_ERROR", error)
        }
    }

    @objc func setWidgetPrivacy(_ call: CAPPluginCall) {
        guard let owner = activeOwner, !owner.isEmpty else {
            call.reject("Sign in before changing widget privacy")
            return
        }
        guard let showAmounts = call.getBool("showAmounts") else {
            call.reject("showAmounts must be a boolean")
            return
        }
        guard let defaults = UserDefaults(suiteName: appGroup) else {
            call.reject("App Group settings are unavailable", "WIDGET_STORAGE_ERROR")
            return
        }
        defaults.set(showAmounts, forKey: privacyKey)
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve(["showAmounts": showAmounts])
    }

    @objc func getWidgetSettings(_ call: CAPPluginCall) {
        call.resolve(["showAmounts": UserDefaults(suiteName: appGroup)?.bool(forKey: privacyKey) ?? false])
    }

    @objc func clearPrivateData(_ call: CAPPluginCall) {
        do {
            guard let defaults = UserDefaults(suiteName: appGroup) else { throw StorageError.appGroupUnavailable }
            try removeSnapshot()
            defaults.set(false, forKey: privacyKey)
            activeOwner = nil
            WidgetCenter.shared.reloadAllTimelines()
            call.resolve(["ok": true])
        } catch {
            call.reject("Could not clear widget data", "WIDGET_STORAGE_ERROR", error)
        }
    }

    @objc func notificationCommand(_ call: CAPPluginCall) {
        let command = call.getString("command") ?? ""
        switch command {
        case "status":
            call.resolve(["available": false, "enabled": false, "permissionGranted": false, "pendingCount": 0])
        case "appearance":
            guard call.getBool("dark") != nil else {
                call.reject("appearance requires a boolean dark value")
                return
            }
            // iOS controls app appearance and system bars independently; accept the shared cross-platform command.
            call.resolve(["updated": true])
        default:
            call.reject("iOS does not support notification command '\(command)' for reading other apps' notifications", "UNSUPPORTED_IOS_CAPABILITY")
        }
    }

    @objc func readOtherAppNotifications(_ call: CAPPluginCall) {
        call.reject("iOS does not allow apps to read notifications belonging to other apps", "UNSUPPORTED_IOS_CAPABILITY")
    }

    private func safeInteger(_ value: Any?) -> Int64? {
        guard let number = value as? NSNumber else { return nil }
        guard CFGetTypeID(number) != CFBooleanGetTypeID() else { return nil }
        let value = number.doubleValue
        guard value.isFinite, value.rounded(.towardZero) == value, abs(value) <= 9_007_199_254_740_991 else { return nil }
        return Int64(value)
    }

    private func readSnapshot() throws -> (owner: String, values: [String: Any])? {
        guard let directory = sharedDirectory else { throw StorageError.appGroupUnavailable }
        let url = directory.appendingPathComponent(snapshotFilename)
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        let data = try Data(contentsOf: url)
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let owner = object["owner"] as? String else { return nil }
        return (owner, object)
    }

    private func removeSnapshot() throws {
        guard let directory = sharedDirectory else { throw StorageError.appGroupUnavailable }
        let url = directory.appendingPathComponent(snapshotFilename)
        if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) }
    }

    private enum StorageError: Error { case appGroupUnavailable }
}
