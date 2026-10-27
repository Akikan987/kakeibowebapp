package com.kakeibodata.kakeibo.nativeapp;

import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.provider.Settings;
import android.view.View;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "KakeiboDevice")
public final class KakeiboDevicePlugin extends Plugin {
    @PluginMethod public void setOwner(PluginCall call) {
        String owner = call.getString("owner");
        if (owner == null || !owner.matches("[A-Za-z0-9_-]{0,128}")) { call.reject("アカウントを確認できませんでした"); return; }
        DeviceState.setOwner(getContext(), owner);
        call.resolve();
    }

    @PluginMethod public void clearPrivateData(PluginCall call) {
        synchronized (DeviceState.LOCK) {
            DeviceState.disable(getContext());
            new PrivateStore(getContext(), "widget").clear();
            DeviceState.preferences(getContext()).edit().remove("owner").putBoolean("show_amounts", false).commit();
            androidx.work.WorkManager.getInstance(getContext()).cancelUniqueWork("kakeibo-native-maintenance");
            PaymentWidget.updateAll(getContext());
        }
        call.resolve();
    }

    @PluginMethod public void notificationCommand(PluginCall call) {
        String command = call.getString("command", "");
        try {
            switch (command) {
                case "status":
                    if (!DeviceState.hasPermission(getContext()) && DeviceState.enabled(getContext())) DeviceState.disable(getContext());
                    call.resolve(status());
                    break;
                case "enable":
                    if (DeviceState.owner(getContext()).isEmpty()) { call.reject("ログイン後に有効にしてください"); return; }
                    getActivity().runOnUiThread(() -> enable(call));
                    break;
                case "disable":
                    DeviceState.disable(getContext());
                    call.resolve(status());
                    break;
                case "openNotificationSettings":
                    getActivity().runOnUiThread(() -> {
                        try { getActivity().startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)); call.resolve(new JSObject().put("opened", true)); }
                        catch (RuntimeException ignored) { call.reject("Androidの通知アクセス設定を開けませんでした"); }
                    });
                    break;
                case "readPending":
                    requireCapture();
                    call.resolve(new JSObject().put("events", new NotificationStore(getContext()).pending()));
                    break;
                case "ack":
                    requireCapture();
                    int removed = new NotificationStore(getContext()).acknowledge(call.getArray("ids"));
                    call.resolve(new JSObject().put("removed", removed).put("pendingCount", new NotificationStore(getContext()).pending().length()));
                    break;
                case "appearance":
                    Boolean dark = call.getBoolean("dark");
                    if (dark == null) { call.reject("表示テーマを確認できませんでした"); return; }
                    getActivity().runOnUiThread(() -> {
                        int color = Color.parseColor(dark ? "#101418" : "#F5F5F7");
                        getActivity().getWindow().setStatusBarColor(color);
                        getActivity().getWindow().setNavigationBarColor(color);
                        if (Build.VERSION.SDK_INT >= 30) {
                            android.view.WindowInsetsController bars = getActivity().getWindow().getInsetsController();
                            if (bars != null) {
                                int light = android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                                bars.setSystemBarsAppearance(dark ? 0 : light, light);
                            }
                        } else getActivity().getWindow().getDecorView().setSystemUiVisibility(dark ? 0 : View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
                        call.resolve(new JSObject().put("updated", true));
                    });
                    break;
                default: call.reject("対応していない操作です");
            }
        } catch (Exception ignored) { call.reject("通知読み取りが無効か、保存データを確認できませんでした"); }
    }

    private void requireCapture() {
        if (!DeviceState.enabled(getContext()) || !DeviceState.hasPermission(getContext())) {
            if (!DeviceState.hasPermission(getContext())) DeviceState.disable(getContext());
            throw new IllegalStateException();
        }
    }
    private JSObject status() {
        boolean permission = DeviceState.hasPermission(getContext());
        boolean enabled = DeviceState.enabled(getContext());
        return new JSObject().put("available", true).put("enabled", enabled).put("permissionGranted", permission)
            .put("pendingCount", enabled && permission ? new NotificationStore(getContext()).pending().length() : 0);
    }
    private void enable(PluginCall call) {
        final String owner = DeviceState.owner(getContext());
        new AlertDialog.Builder(getActivity()).setTitle("銀行通知の読み取りを有効にしますか？")
            .setMessage("三井住友銀行・Vpassの取引通知だけを対象にします。認証コード・ログインの通知は除外し、リンク・メール等は加工しますが、個人情報の完全除去は保証できません。本文は端末内で暗号化し、最大50件・7日間保存します。「通知を読み込む」の操作後に候補を確認して保存します。保存した明細は現在の家計簿アカウントへ同期されます。停止・ログアウト・アカウント切替で保留通知を消去します。")
            .setNegativeButton("キャンセル", (dialog, which) -> call.resolve(status().put("cancelled", true)))
            .setOnCancelListener(dialog -> call.resolve(status().put("cancelled", true)))
            .setPositiveButton("同意して続ける", (dialog, which) -> {
                synchronized (DeviceState.LOCK) {
                    if (owner.isEmpty() || !owner.equals(DeviceState.owner(getContext()))) { call.reject("アカウントが変わりました。やり直してください"); return; }
                    if (DeviceState.hasPermission(getContext())) {
                        DeviceState.preferences(getContext()).edit().putBoolean("capture", true).remove("pending_owner").commit();
                        DeviceState.schedule(getContext());
                        call.resolve(status());
                    } else {
                        DeviceState.preferences(getContext()).edit().putString("pending_owner", owner).commit();
                        try {
                            getActivity().startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
                            call.resolve(status().put("settingsOpened", true));
                        } catch (RuntimeException ignored) {
                            DeviceState.preferences(getContext()).edit().remove("pending_owner").commit();
                            call.reject("Androidの通知アクセス設定を開けませんでした");
                        }
                    }
                }
            }).show();
    }

    @PluginMethod public void updateWidget(PluginCall call) {
        synchronized (DeviceState.LOCK) {
            String owner = call.getString("owner", "");
            if (owner.isEmpty() || !NotificationFilter.digest(owner).equals(DeviceState.owner(getContext()))) { call.reject("アカウントが変わりました"); return; }
            try {
                JSONObject value = call.getData();
                long now = System.currentTimeMillis();
                // Capacitor getLong accepts Long only; JSON amounts/zero are usually Integer.
                Long total = WidgetPolicy.jsonInteger(value.opt("monthTotal"));
                Long nextAmount = WidgetPolicy.jsonInteger(value.opt("nextAmount"));
                Long updatedAt = WidgetPolicy.jsonInteger(value.opt("updatedAt"));
                Long lastSync = WidgetPolicy.jsonInteger(value.opt("lastSync"));
                String state = call.getString("state", "");
                String monthKey = call.getString("monthKey", "");
                Long nextDate = value.isNull("nextDate") ? null : WidgetPolicy.jsonInteger(value.opt("nextDate"));
                if (!value.has("nextDate") || !value.isNull("nextDate") && nextDate == null) throw new IllegalArgumentException();
                if (!WidgetPolicy.validSnapshot(total, nextAmount, updatedAt, lastSync, nextDate, state, monthKey, now)) throw new IllegalArgumentException();
                JSONObject snapshot = new JSONObject().put("owner", DeviceState.owner(getContext())).put("monthTotal", total)
                    .put("nextAmount", nextAmount).put("nextDate", nextDate == null ? JSONObject.NULL : nextDate)
                    .put("updatedAt", updatedAt).put("lastSync", lastSync).put("state", state).put("monthKey", monthKey);
                new PrivateStore(getContext(), "widget").write("snapshot", snapshot.toString());
                DeviceState.schedule(getContext());
                PaymentWidget.updateAll(getContext());
                call.resolve(new JSObject().put("updated", true));
            } catch (Exception ignored) { call.reject("支払予定ウィジェットを更新できませんでした"); }
        }
    }
    @PluginMethod public void getWidgetSettings(PluginCall call) {
        call.resolve(new JSObject().put("showAmounts", DeviceState.preferences(getContext()).getBoolean("show_amounts", false)));
    }
    @PluginMethod public void setWidgetPrivacy(PluginCall call) {
        Boolean show = call.getBoolean("showAmounts");
        synchronized (DeviceState.LOCK) {
            if (show == null || DeviceState.owner(getContext()).isEmpty()) { call.reject("ログイン状態と表示設定を確認してください"); return; }
            DeviceState.preferences(getContext()).edit().putBoolean("show_amounts", show).commit();
            PaymentWidget.updateAll(getContext());
        }
        call.resolve(new JSObject().put("showAmounts", show));
    }
}
