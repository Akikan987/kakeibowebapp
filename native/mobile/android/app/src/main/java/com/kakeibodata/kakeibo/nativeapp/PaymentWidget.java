package com.kakeibodata.kakeibo.nativeapp;

import android.app.KeyguardManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;
import org.json.JSONObject;
import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public final class PaymentWidget extends AppWidgetProvider {
    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        updateAll(context);
        if (!DeviceState.owner(context).isEmpty()) DeviceState.schedule(context);
    }
    @Override public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (Intent.ACTION_USER_PRESENT.equals(intent.getAction())) updateAll(context);
    }
    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName component = new ComponentName(context, PaymentWidget.class);
        int[] ids = manager.getAppWidgetIds(component);
        if (ids.length == 0) return;
        RemoteViews view = new RemoteViews(context.getPackageName(), R.layout.payment_widget);
        view.setOnClickPendingIntent(R.id.widget_open, launch(context, "withdrawals", 8101));
        view.setOnClickPendingIntent(R.id.widget_add, launch(context, "add-expense", 8102));
        view.setTextViewText(R.id.widget_total, "金額は非表示");
        view.setTextViewText(R.id.widget_next, "アプリで支払予定を確認");
        view.setTextViewText(R.id.widget_updated, "ログインしてアプリを開いてください");
        synchronized (DeviceState.LOCK) {
            try {
                String raw = new PrivateStore(context, "widget").read("snapshot");
                if (!DeviceState.owner(context).isEmpty() && raw != null) {
                    JSONObject snapshot = new JSONObject(raw);
                    if (!DeviceState.owner(context).equals(snapshot.optString("owner"))) throw new IllegalArgumentException();
                    long now = System.currentTimeMillis();
                    boolean stale = WidgetPolicy.stale(snapshot.getLong("updatedAt"), snapshot.getString("monthKey"), now, WidgetPolicy.monthKey(now));
                    KeyguardManager guard = context.getSystemService(KeyguardManager.class);
                    boolean locked = guard == null || guard.isKeyguardLocked();
                    boolean reveal = WidgetPolicy.showAmounts(DeviceState.preferences(context).getBoolean("show_amounts", false), locked, stale);
                    NumberFormat yen = NumberFormat.getIntegerInstance(Locale.JAPAN);
                    view.setTextViewText(R.id.widget_total, reveal ? "¥" + yen.format(snapshot.getLong("monthTotal")) : stale ? "アプリで更新してください" : "金額は非表示");
                    if (!stale && !locked) {
                        String next = snapshot.isNull("nextDate") ? "次の引き落とし予定なし" : new SimpleDateFormat("M/d", Locale.JAPAN).format(new Date(snapshot.getLong("nextDate"))) + " 引き落とし予定";
                        if (reveal && !snapshot.isNull("nextDate")) next += " ¥" + yen.format(snapshot.getLong("nextAmount"));
                        view.setTextViewText(R.id.widget_next, next);
                    }
                    String state = snapshot.getString("state");
                    String status = stale ? "古い表示・アプリで再計算" : "offline".equals(state) ? "オフライン・端末の記録" : "error".equals(state) ? "同期失敗・端末の記録" : "端末の記録から計算";
                    String computed = new SimpleDateFormat("M/d HH:mm", Locale.JAPAN).format(new Date(snapshot.getLong("updatedAt")));
                    long lastSync = snapshot.getLong("lastSync");
                    String synced = lastSync > 0 ? new SimpleDateFormat("M/d HH:mm", Locale.JAPAN).format(new Date(lastSync)) : "未同期";
                    view.setTextViewText(R.id.widget_updated, status + "\n計算 " + computed + " / 同期 " + synced);
                }
            } catch (Exception ignored) {
                new PrivateStore(context, "widget").clear();
                view.setTextViewText(R.id.widget_updated, "表示データを読み取れません。アプリで更新してください");
            }
        }
        for (int id : ids) manager.updateAppWidget(id, view);
    }
    private static PendingIntent launch(Context context, String target, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class).setAction(Intent.ACTION_VIEW).setData(Uri.parse("kakeibo-native://" + target))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}
