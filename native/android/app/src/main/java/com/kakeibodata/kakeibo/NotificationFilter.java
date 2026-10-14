package com.kakeibodata.kakeibo;

import java.util.Locale;
import java.util.regex.Pattern;

final class NotificationFilter {
    private static final Pattern AMOUNT = Pattern.compile(
            "(?:[¥￥]\\s*[0-9][0-9,]*(?:\\.[0-9]{1,2})?|[0-9][0-9,]*\\s*円)"
    );
    private static final Pattern TRANSACTION = Pattern.compile(
            "利用|入金|出金|引落|引き落とし|お支払い|支払|振込|送金|チャージ|買物|決済|payment|transfer|withdraw|deposit|purchase|charged",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );
    private static final Pattern SENSITIVE = Pattern.compile(
            "認証|確認コード|ワンタイム|otp|password|パスワード|ログイン|login|security|セキュリティ|本人確認|二段階|2段階|二要素|verification|verify|暗証番号",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );

    private NotificationFilter() { }

    static boolean isAllowedPackage(String packageName) {
        return "jp.co.smbc.direct".equals(packageName)
                || "com.smbc_card.vpass".equals(packageName);
    }

    static boolean isTransactionNotice(String packageName, String title, String body) {
        if (!isAllowedPackage(packageName) || title == null || body == null || body.trim().isEmpty()) return false;
        String combined = (title + "\n" + body).toLowerCase(Locale.ROOT);
        if (SENSITIVE.matcher(combined).find()) return false;
        return AMOUNT.matcher(body).find() && TRANSACTION.matcher(combined).find();
    }
}
