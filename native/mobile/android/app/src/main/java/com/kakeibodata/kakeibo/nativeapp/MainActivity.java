package com.kakeibodata.kakeibo.nativeapp;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private final BroadcastReceiver screenReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            PaymentWidget.updateAll(context);
        }
    };

    @Override public void onCreate(Bundle state) {
        registerPlugin(KakeiboDevicePlugin.class);
        super.onCreate(state);
        // Prevent account/notification details appearing in the recent-apps preview.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        IntentFilter screen = new IntentFilter(Intent.ACTION_SCREEN_OFF);
        screen.addAction(Intent.ACTION_USER_PRESENT);
        ContextCompat.registerReceiver(this, screenReceiver, screen, ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    @Override public void onResume() {
        super.onResume();
        DeviceState.resume(this);
        PaymentWidget.updateAll(this);
    }

    @Override public void onDestroy() {
        unregisterReceiver(screenReceiver);
        super.onDestroy();
    }
}
