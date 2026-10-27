package com.kakeibodata.kakeibo.app;

import android.content.Intent;
import android.net.Uri;
import com.google.androidbrowserhelper.trusted.LauncherActivity;

/** Chrome provides rendering, uploads, downloads, cookies and the existing OAuth flow. */
public final class MainActivity extends LauncherActivity {
    @Override
    protected Uri getLaunchingUrl() {
        return Uri.parse(LaunchPolicy.trustedLaunchUrl(getIntent().getDataString()));
    }

    @Override
    protected Uri getUrlForIntent(Intent intent) {
        return intent.getData() == null ? null : Uri.parse(LaunchPolicy.trustedLaunchUrl(intent.getDataString()));
    }
}
