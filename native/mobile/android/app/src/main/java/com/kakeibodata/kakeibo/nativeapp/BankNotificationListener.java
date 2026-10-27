package com.kakeibodata.kakeibo.nativeapp;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

public final class BankNotificationListener extends NotificationListenerService {
    @Override public void onNotificationPosted(StatusBarNotification notice) {
        if (!DeviceState.enabled(this) || !NotificationFilter.isAllowedPackage(notice.getPackageName())) return;
        Bundle extras = notice.getNotification().extras;
        if (extras == null) return;
        CharSequence titleValue = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence bodyValue = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        if (bodyValue == null) bodyValue = extras.getCharSequence(Notification.EXTRA_TEXT);
        if (bodyValue == null) {
            CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
            if (lines != null) {
                StringBuilder body = new StringBuilder();
                for (int i = 0; i < Math.min(lines.length, 20); i++) {
                    if (lines[i] != null && body.length() < 4000) body.append(lines[i]).append('\n');
                }
                bodyValue = body;
            }
        }
        String title = titleValue == null ? "" : titleValue.toString();
        String body = bodyValue == null ? "" : bodyValue.toString();
        if (title.length() > 4000 || body.length() > 4000) return;
        if (NotificationFilter.isTransactionNotice(notice.getPackageName(), title, body)) {
            new NotificationStore(this).add(notice.getPackageName(), title, body, notice.getPostTime());
        }
    }
    @Override public void onListenerDisconnected() {
        // Temporary OS disconnects do not revoke consent, but actual permission loss erases capture.
        if (!DeviceState.hasPermission(this)) DeviceState.disable(this);
        super.onListenerDisconnected();
    }
}
