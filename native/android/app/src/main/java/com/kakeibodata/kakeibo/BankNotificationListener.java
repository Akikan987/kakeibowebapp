package com.kakeibodata.kakeibo;

import android.app.Notification;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.os.Bundle;

public final class BankNotificationListener extends NotificationListenerService {
    @Override
    public void onNotificationPosted(StatusBarNotification statusBarNotification) {
        if (!getSharedPreferences(MainActivity.PREFS_NAME, MODE_PRIVATE)
                .getBoolean(MainActivity.PREF_ENABLED, false)) return;

        String packageName = statusBarNotification.getPackageName();
        if (!NotificationFilter.isAllowedPackage(packageName)) return;
        Bundle extras = statusBarNotification.getNotification().extras;
        if (extras == null) return;

        CharSequence titleValue = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence bodyValue = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        if (bodyValue == null) bodyValue = extras.getCharSequence(Notification.EXTRA_TEXT);
        if (bodyValue == null) {
            CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
            if (lines != null) {
                StringBuilder joined = new StringBuilder();
                for (CharSequence line : lines) {
                    if (line != null) {
                        if (joined.length() > 0) joined.append('\n');
                        joined.append(line);
                    }
                }
                bodyValue = joined;
            }
        }
        String title = titleValue == null ? "" : titleValue.toString();
        String body = bodyValue == null ? "" : bodyValue.toString();
        if (!NotificationFilter.isTransactionNotice(packageName, title, body)) return;

        new EncryptedNotificationStore(this).add(packageName, title, body,
                statusBarNotification.getPostTime());
    }
}
