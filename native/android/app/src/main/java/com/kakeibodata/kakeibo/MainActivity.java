package com.kakeibodata.kakeibo;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.NotificationManager;
import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.SslErrorHandler;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;

public final class MainActivity extends Activity {
    static final String PREFS_NAME = "bank_notice_control_v1";
    static final String PREF_ENABLED = "capture_enabled";
    private static final String PREF_ENABLE_AFTER_SETTINGS = "enable_after_settings";
    private static final String APP_URL = "https://app.kakeibodata.com/";
    private static final String APP_HOST = "app.kakeibodata.com";
    private static final String BRIDGE_NAME = "KakeiboNative";
    private static final int REQUEST_FILE = 7214;

    private FrameLayout root;
    private FrameLayout pageContainer;
    private WebView webView;
    private View offlineView;
    private ProgressBar progressBar;
    private ValueCallback<Uri[]> pendingFileCallback;
    private Object backCallback;
    private boolean darkAppearance = true;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        applyAppearance(darkAppearance);

        root = new FrameLayout(this);
        root.setBackgroundColor(backgroundColor(darkAppearance));
        setContentView(root);
        applySystemInsets();
        if (Build.VERSION.SDK_INT >= 33) {
            backCallback = Api33Back.register(this);
        }

        pageContainer = new FrameLayout(this);
        root.addView(pageContainer, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setIndeterminate(true);
        pageContainer.addView(progressBar, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(3), Gravity.TOP));

        webView = new WebView(this);
        configureWebView();
        FrameLayout.LayoutParams webParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
        pageContainer.addView(webView, 0, webParams);

        offlineView = makeOfflineView();
        offlineView.setVisibility(View.GONE);
        pageContainer.addView(offlineView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            showOffline("この端末のWebViewは必要な機能に対応していません。Android System WebViewを更新してください。");
        } else {
            installNativeBridge();
            webView.loadUrl(APP_URL);
        }
    }

    private void applySystemInsets() {
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT < 30) {
                view.setPadding(0, 0, 0, 0);
                return insets;
            }
            int top;
            int bottom;
            android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
            top = bars.top;
            bottom = bars.bottom;
            view.setPadding(0, top, 0, bottom);
            return WindowInsets.CONSUMED;
        });
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSafeBrowsingEnabled(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return routeUrl(request.getUrl());
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return routeUrl(Uri.parse(url));
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if (isAppOrigin(Uri.parse(url))) {
                    offlineView.setVisibility(View.GONE);
                    progressBar.setVisibility(View.VISIBLE);
                } else {
                    view.stopLoading();
                    routeUrl(Uri.parse(url));
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
                if (isAppOrigin(Uri.parse(url))) offlineView.setVisibility(View.GONE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showOffline("接続できませんでした。通信状態を確認して、もう一度お試しください。");
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler,
                                           android.net.http.SslError error) {
                handler.cancel();
                showOffline("安全な接続を確認できませんでした。時間をおいて再度お試しください。");
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> filePathCallback,
                                             FileChooserParams fileChooserParams) {
                if (pendingFileCallback != null) pendingFileCallback.onReceiveValue(null);
                pendingFileCallback = filePathCallback;
                String[] acceptedTypes = AcceptedMimeTypes.fromAcceptTypes(fileChooserParams.getAcceptTypes());
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                if (acceptedTypes != null && acceptedTypes.length > 1) {
                    intent.setType("*/*");
                    intent.putExtra(Intent.EXTRA_MIME_TYPES, acceptedTypes);
                } else intent.setType(acceptedTypes.length == 0 ? "image/*" : acceptedTypes[0]);
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, fileChooserParams.getMode()
                        == FileChooserParams.MODE_OPEN_MULTIPLE);
                try {
                    startActivityForResult(intent, REQUEST_FILE);
                } catch (ActivityNotFoundException exception) {
                    pendingFileCallback = null;
                    filePathCallback.onReceiveValue(null);
                    Toast.makeText(MainActivity.this, "ファイルを選べるアプリがありません", Toast.LENGTH_SHORT).show();
                }
                return true;
            }

            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
            }
        });
    }

    private void installNativeBridge() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        Set<String> origins = new HashSet<>();
        origins.add("https://" + APP_HOST);
        WebViewCompat.addWebMessageListener(webView, BRIDGE_NAME, origins,
                (view, message, sourceOrigin, isMainFrame, replyProxy) -> {
                    if (!isMainFrame || !isAppOrigin(Uri.parse(sourceOrigin.toString()))
                            || !isAppOrigin(Uri.parse(view.getUrl() == null ? "" : view.getUrl()))) return;
                    handleBridgeMessage(message, replyProxy);
                });
    }

    private void handleBridgeMessage(WebMessageCompat message, JavaScriptReplyProxy replyProxy) {
        JSONObject request;
        String requestId = "";
        try {
            if (message.getType() != WebMessageCompat.TYPE_STRING) return;
            String raw = message.getData();
            if (raw == null || raw.length() > 4096) return;
            request = new JSONObject(raw);
            requestId = request.optString("requestId", "");
            if (requestId.length() > 100 || requestId.isEmpty()) return;
            if (request.optInt("version", 1) != 1) throw new JSONException("Unsupported bridge version");
            String command = request.optString("command", "");
            JSONObject result;
            switch (command) {
                case "status":
                    result = statusResult();
                    break;
                case "appearance":
                    if (!request.has("dark") || request.isNull("dark")
                            || !(request.opt("dark") instanceof Boolean))
                        throw new JSONException("Invalid appearance mode");
                    applyAppearance(request.getBoolean("dark"));
                    result = new JSONObject().put("updated", true);
                    break;
                case "enable":
                    requestEnable(requestId, replyProxy);
                    return;
                case "disable":
                    getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
                            .putBoolean(PREF_ENABLED, false)
                            .putBoolean(PREF_ENABLE_AFTER_SETTINGS, false).apply();
                    new EncryptedNotificationStore(this).clear();
                    result = new JSONObject().put("enabled", false).put("pendingCount", 0);
                    break;
                case "openNotificationSettings":
                    openNotificationAccessSettings();
                    result = new JSONObject().put("opened", true);
                    break;
                case "readPending":
                    requireCaptureReady();
                    result = new JSONObject().put("events", new EncryptedNotificationStore(this).readPending());
                    break;
                case "ack":
                    requireCaptureReady();
                    JSONArray ids = request.optJSONArray("ids");
                    if (ids == null || ids.length() > EncryptedNotificationStore.MAX_EVENTS)
                        throw new JSONException("Invalid event IDs");
                    int removed = new EncryptedNotificationStore(this).acknowledge(ids);
                    result = new JSONObject().put("removed", removed)
                            .put("pendingCount", new EncryptedNotificationStore(this).count());
                    break;
                default:
                    throw new JSONException("Unknown command");
            }
            sendReply(replyProxy, requestId, result, null);
        } catch (Exception exception) {
            sendReply(replyProxy, requestId, null,
                    exception.getMessage() == null ? "Request failed" : exception.getMessage());
        }
    }

    private JSONObject statusResult() throws JSONException {
        boolean enabled = getSharedPreferences(PREFS_NAME, MODE_PRIVATE).getBoolean(PREF_ENABLED, false);
        boolean permission = hasNotificationAccess();
        int count = enabled && permission ? new EncryptedNotificationStore(this).count() : 0;
        return new JSONObject().put("available", true).put("enabled", enabled)
                .put("permissionGranted", permission).put("pendingCount", count);
    }

    private void requestEnable(String requestId, JavaScriptReplyProxy replyProxy) {
        new AlertDialog.Builder(this)
                .setTitle("銀行通知の読み取りを有効にしますか？")
                .setMessage("SMBCダイレクトと三井住友カード Vpass の取引通知だけを対象にします。認証コード、ログイン、本人確認などの通知は保存しません。通知本文はこの端末内で暗号化し、最大50件・7日間保存します。家計簿側へ通知を渡すのは「通知を読み込む」を押したときだけです。受け渡し後の登録や同期は、家計簿アプリの表示内容をご確認ください。いつでも停止して保存分を削除できます。")
                .setNegativeButton("キャンセル", (dialog, which) -> sendReply(replyProxy, requestId,
                        json("enabled", false, "cancelled", true), null))
                .setPositiveButton("同意して続ける", (dialog, which) -> {
                    if (hasNotificationAccess()) {
                        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
                                .putBoolean(PREF_ENABLED, true)
                                .putBoolean(PREF_ENABLE_AFTER_SETTINGS, false).apply();
                        sendReply(replyProxy, requestId, json("enabled", true, "permissionGranted", true), null);
                    } else {
                        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
                                .putBoolean(PREF_ENABLE_AFTER_SETTINGS, true).apply();
                        openNotificationAccessSettings();
                        sendReply(replyProxy, requestId, json("enabled", false,
                                "permissionGranted", false, "settingsOpened", true), null);
                    }
                }).show();
    }

    private void requireCaptureReady() throws JSONException {
        boolean enabled = getSharedPreferences(PREFS_NAME, MODE_PRIVATE).getBoolean(PREF_ENABLED, false);
        if (!enabled || !hasNotificationAccess()) throw new JSONException("Notification reading is not enabled");
    }

    private void openNotificationAccessSettings() {
        try {
            startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
        } catch (ActivityNotFoundException exception) {
            Toast.makeText(this, "Androidの通知アクセス設定を開けませんでした", Toast.LENGTH_SHORT).show();
        }
    }

    private boolean hasNotificationAccess() {
        ComponentName component = new ComponentName(this, BankNotificationListener.class);
        if (Build.VERSION.SDK_INT >= 27) {
            return getSystemService(NotificationManager.class).isNotificationListenerAccessGranted(component);
        }
        String enabled = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
        return !TextUtils.isEmpty(enabled) && enabled.contains(component.flattenToString());
    }

    @SuppressLint("RequiresFeature")
    private static void sendReply(JavaScriptReplyProxy proxy, String requestId,
                                  JSONObject result, String error) {
        if (requestId == null || requestId.isEmpty()
                || !WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        JSONObject response = new JSONObject();
        try {
            response.put("version", 1);
            response.put("requestId", requestId);
            if (error == null) response.put("result", result == null ? new JSONObject() : result);
            else response.put("error", error);
            proxy.postMessage(response.toString());
        } catch (JSONException ignored) { }
    }

    private static JSONObject json(Object... keyValues) {
        JSONObject result = new JSONObject();
        try {
            for (int index = 0; index + 1 < keyValues.length; index += 2) {
                result.put(String.valueOf(keyValues[index]), keyValues[index + 1]);
            }
        } catch (JSONException ignored) { }
        return result;
    }

    private void applyAppearance(boolean dark) {
        darkAppearance = dark;
        int background = backgroundColor(dark);
        int foreground = dark ? Color.rgb(245, 245, 247) : Color.rgb(29, 29, 31);
        int secondary = dark ? Color.rgb(171, 178, 188) : Color.rgb(104, 104, 110);
        getWindow().setStatusBarColor(background);
        getWindow().setNavigationBarColor(background);
        if (Build.VERSION.SDK_INT >= 30) {
            android.view.WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                int appearance = dark ? 0
                        : android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                        | android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                controller.setSystemBarsAppearance(appearance,
                        android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                                | android.view.WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(dark ? 0
                    : View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        }
        if (root != null) root.setBackgroundColor(background);
        if (offlineView != null) {
            offlineView.setBackgroundColor(background);
            View title = ((ViewGroup) offlineView).getChildAt(0);
            View detail = ((ViewGroup) offlineView).getChildAt(1);
            if (title instanceof TextView) ((TextView) title).setTextColor(foreground);
            if (detail instanceof TextView) ((TextView) detail).setTextColor(secondary);
        }
    }

    private static int backgroundColor(boolean dark) {
        return dark ? Color.rgb(16, 20, 24) : Color.rgb(245, 245, 247);
    }

    private boolean routeUrl(Uri uri) {
        if (isAppOrigin(uri)) return false;
        String scheme = uri.getScheme();
        if ("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme)) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (ActivityNotFoundException exception) {
                Toast.makeText(this, "リンクを開けるブラウザーがありません", Toast.LENGTH_SHORT).show();
            }
        } else {
            Toast.makeText(this, "この種類のリンクはアプリ内から開けません", Toast.LENGTH_SHORT).show();
        }
        return true;
    }

    private static boolean isAppOrigin(Uri uri) {
        return uri != null && "https".equalsIgnoreCase(uri.getScheme())
                && APP_HOST.equalsIgnoreCase(uri.getHost())
                && (uri.getPort() == -1 || uri.getPort() == 443)
                && uri.getUserInfo() == null;
    }

    private View makeOfflineView() {
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        panel.setPadding(dp(28), dp(24), dp(28), dp(24));
        panel.setBackgroundColor(backgroundColor(darkAppearance));
        TextView title = new TextView(this);
        title.setText("家計簿に接続できません");
        title.setTextColor(darkAppearance ? Color.rgb(245, 245, 247) : Color.rgb(29, 29, 31));
        title.setTextSize(20);
        title.setGravity(Gravity.CENTER);
        panel.addView(title, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        TextView detail = new TextView(this);
        detail.setTag("detail");
        detail.setText("通信状態を確認して、もう一度お試しください。");
        detail.setTextColor(darkAppearance ? Color.rgb(171, 178, 188) : Color.rgb(104, 104, 110));
        detail.setTextSize(15);
        detail.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams detailParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        detailParams.topMargin = dp(12);
        panel.addView(detail, detailParams);
        Button retry = new Button(this);
        retry.setText("再読み込み");
        retry.setOnClickListener(view -> {
            detail.setText("通信状態を確認して、もう一度お試しください。");
            offlineView.setVisibility(View.GONE);
            webView.reload();
        });
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        buttonParams.topMargin = dp(16);
        panel.addView(retry, buttonParams);
        return panel;
    }

    private void showOffline(String message) {
        runOnUiThread(() -> {
            if (offlineView != null) {
                TextView detail = (TextView) offlineView.findViewWithTag("detail");
                if (detail != null) detail.setText(message);
                else {
                    for (int index = 0; index < ((ViewGroup) offlineView).getChildCount(); index++) {
                        View child = ((ViewGroup) offlineView).getChildAt(index);
                        if (child instanceof TextView && index == 1) ((TextView) child).setText(message);
                    }
                }
                offlineView.setVisibility(View.VISIBLE);
            }
            if (progressBar != null) progressBar.setVisibility(View.GONE);
        });
    }

    @Override
    protected void onPause() {
        CookieManager.getInstance().flush();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        android.content.SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        if (prefs.getBoolean(PREF_ENABLE_AFTER_SETTINGS, false)) {
            if (hasNotificationAccess()) {
                prefs.edit().putBoolean(PREF_ENABLED, true)
                        .putBoolean(PREF_ENABLE_AFTER_SETTINGS, false).apply();
                Toast.makeText(this, "銀行通知の読み取りを有効にしました", Toast.LENGTH_SHORT).show();
            } else {
                prefs.edit().putBoolean(PREF_ENABLE_AFTER_SETTINGS, false).apply();
            }
        } else if (prefs.getBoolean(PREF_ENABLED, false) && !hasNotificationAccess()) {
            prefs.edit().putBoolean(PREF_ENABLED, false).apply();
            new EncryptedNotificationStore(this).clear();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQUEST_FILE || pendingFileCallback == null) return;
        Uri[] results = null;
        if (resultCode == Activity.RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                results = new Uri[count];
                for (int index = 0; index < count; index++) results[index] = data.getClipData().getItemAt(index).getUri();
            } else if (data.getData() != null) {
                results = new Uri[]{data.getData()};
            }
        }
        ValueCallback<Uri[]> callback = pendingFileCallback;
        pendingFileCallback = null;
        callback.onReceiveValue(results);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        handleBack();
    }

    private void handleBack() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else finish();
    }

    @Override
    protected void onDestroy() {
        if (Build.VERSION.SDK_INT >= 33) {
            Api33Back.unregister(this, backCallback);
        }
        if (pendingFileCallback != null) pendingFileCallback.onReceiveValue(null);
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }

    /** Keep all API 33 symbol references isolated from Activity verification on API 26-32. */
    @android.annotation.TargetApi(33)
    private static final class Api33Back {
        static Object register(MainActivity activity) {
            android.window.OnBackInvokedCallback callback = activity::handleBack;
            activity.getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, callback);
            return callback;
        }

        static void unregister(MainActivity activity, Object callback) {
            if (callback instanceof android.window.OnBackInvokedCallback) {
                activity.getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(
                        (android.window.OnBackInvokedCallback) callback);
            }
        }
    }
}
