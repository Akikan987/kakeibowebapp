package com.kakeibodata.kakeibo.nativeapp;

import android.content.Context;
import android.content.ComponentName;
import android.appwidget.AppWidgetHost;
import android.appwidget.AppWidgetHostView;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.widget.TextView;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Runs only in the separate .debug package on a disposable emulator. */
@RunWith(AndroidJUnit4.class)
public class PrivateStateTest {
    private final Context context = ApplicationProvider.getApplicationContext();
    @After public void clean() {
        DeviceState.setOwner(context, "");
        new PrivateStore(context, "fixture").clear();
    }
    @Test public void keystoreCiphertextRoundTripAndDeletion() throws Exception {
        PrivateStore store = new PrivateStore(context, "fixture");
        store.clear();
        store.write("fixture", "synthetic-private-amount-123");
        assertFalse(store.preferences.getString("fixture", "").contains("synthetic-private-amount"));
        assertEquals("synthetic-private-amount-123", store.read("fixture"));
        store.clear();
        assertNull(store.read("fixture"));
    }
    @Test public void switchingOwnerClearsSnapshotConsentAndPrivacy() throws Exception {
        DeviceState.setOwner(context, "synthetic-owner-a");
        new PrivateStore(context, "widget").write("snapshot", "synthetic-snapshot");
        DeviceState.preferences(context).edit().putBoolean("capture", true).putBoolean("show_amounts", true).commit();
        DeviceState.setOwner(context, "synthetic-owner-b");
        assertNull(new PrivateStore(context, "widget").read("snapshot"));
        assertFalse(DeviceState.enabled(context));
        assertFalse(DeviceState.preferences(context).getBoolean("show_amounts", true));
        DeviceState.setOwner(context, "");
        assertEquals("", DeviceState.owner(context));
    }
    @Test public void permissionlessCaptureDoesNotCreateCandidates() {
        DeviceState.setOwner(context, "synthetic-owner-a");
        DeviceState.preferences(context).edit().putBoolean("capture", true).commit();
        assertFalse(DeviceState.hasPermission(context));
        new NotificationStore(context).add("com.smbc_card.vpass", "カード利用", "利用 123円", System.currentTimeMillis());
        assertEquals(0, new NotificationStore(context).pending().length());
        DeviceState.resume(context);
        assertFalse(DeviceState.enabled(context));
    }
    @Test public void widgetRendersThroughAndroidHostWithAmountsHidden() throws Exception {
        DeviceState.setOwner(context, "synthetic-owner-a");
        long now = System.currentTimeMillis();
        org.json.JSONObject snapshot = new org.json.JSONObject().put("owner", DeviceState.owner(context))
            .put("monthTotal", 12345).put("nextAmount", 1200).put("nextDate", now + 86400000)
            .put("updatedAt", now).put("lastSync", now).put("state", "current").put("monthKey", WidgetPolicy.monthKey(now));
        new PrivateStore(context, "widget").write("snapshot", snapshot.toString());
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        AppWidgetHost host = new AppWidgetHost(context, 90701);
        int id = host.allocateAppWidgetId();
        android.app.UiAutomation automation = InstrumentationRegistry.getInstrumentation().getUiAutomation();
        automation.adoptShellPermissionIdentity(android.Manifest.permission.BIND_APPWIDGET);
        try {
            assertTrue("Widget provider must bind under the emulator's temporary shell identity", manager.bindAppWidgetIdIfAllowed(id, new ComponentName(context, PaymentWidget.class)));
            PaymentWidget.updateAll(context);
            AppWidgetProviderInfo info = manager.getAppWidgetInfo(id);
            InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
                AppWidgetHostView view = host.createView(context, id, info);
                TextView total = view.findViewById(R.id.widget_total);
                assertNotNull("RemoteViews layout must inflate without an error view", total);
                assertEquals("金額は非表示", total.getText().toString());
                assertNotNull(view.findViewById(R.id.widget_add));
            });
        } finally { host.deleteAppWidgetId(id); host.deleteHost(); automation.dropShellPermissionIdentity(); }
    }
}
