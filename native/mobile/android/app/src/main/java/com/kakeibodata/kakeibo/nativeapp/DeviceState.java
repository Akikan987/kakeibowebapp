package com.kakeibodata.kakeibo.nativeapp;

import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.provider.Settings;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import java.util.concurrent.TimeUnit;

final class DeviceState {
    static final Object LOCK = new Object();
    private DeviceState() {}
    static SharedPreferences preferences(Context context) { return context.getSharedPreferences("native_control_v1", Context.MODE_PRIVATE); }
    static String owner(Context context) { return preferences(context).getString("owner", ""); }
    static boolean enabled(Context context) { return !owner(context).isEmpty() && preferences(context).getBoolean("capture", false); }
    static boolean hasPermission(Context context) {
        ComponentName component = new ComponentName(context, BankNotificationListener.class);
        if (Build.VERSION.SDK_INT >= 27) return context.getSystemService(NotificationManager.class).isNotificationListenerAccessGranted(component);
        String value = Settings.Secure.getString(context.getContentResolver(), "enabled_notification_listeners");
        if (value == null) return false;
        for (String candidate : value.split(":")) if (component.flattenToString().equals(candidate)) return true;
        return false;
    }
    static void disable(Context context) {
        synchronized (LOCK) {
            preferences(context).edit().putBoolean("capture", false).remove("pending_owner").commit();
            new NotificationStore(context).clear();
        }
    }
    static void setOwner(Context context, String value) {
        synchronized (LOCK) {
            String hashed = value.isEmpty() ? "" : NotificationFilter.digest(value);
            if (hashed.equals(owner(context))) return;
            disable(context);
            new PrivateStore(context, "widget").clear();
            preferences(context).edit().putString("owner", hashed).putBoolean("show_amounts", false).commit();
            PaymentWidget.updateAll(context);
            if (hashed.isEmpty()) WorkManager.getInstance(context).cancelUniqueWork("kakeibo-native-maintenance");
            else schedule(context);
        }
    }
    static void resume(Context context) {
        synchronized (LOCK) {
            SharedPreferences prefs = preferences(context);
            String pending = prefs.getString("pending_owner", "");
            if (!pending.isEmpty()) {
                prefs.edit().putBoolean("capture", pending.equals(owner(context)) && hasPermission(context)).remove("pending_owner").commit();
            }
            if (!hasPermission(context) && enabled(context)) disable(context);
        }
    }
    static void schedule(Context context) {
        WorkManager.getInstance(context).enqueueUniquePeriodicWork("kakeibo-native-maintenance", ExistingPeriodicWorkPolicy.KEEP,
            new PeriodicWorkRequest.Builder(WidgetMaintenanceWorker.class, 30, TimeUnit.MINUTES).build());
    }
}
