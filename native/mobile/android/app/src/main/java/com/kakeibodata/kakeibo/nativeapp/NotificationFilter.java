package com.kakeibodata.kakeibo.nativeapp;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** A conservative local filter; this is not a bank-certified transaction parser. */
final class NotificationFilter {
    private static final Pattern AMOUNT = Pattern.compile("(?:[¥￥]\\s*[0-9][0-9,]*(?:\\.[0-9]{1,2})?|[0-9][0-9,]*\\s*円)");
    private static final Pattern TRANSACTION = Pattern.compile("利用|入金|出金|引落|引き落とし|お支払い|支払|振込|送金|チャージ|買物|決済|payment|transfer|withdraw|deposit|purchase|charged", Pattern.CASE_INSENSITIVE);
    private static final Pattern SENSITIVE = Pattern.compile("認証|確認コード|ワンタイム|otp|password|パスワード|ログイン|login|security|セキュリティ|本人確認|二段階|2段階|二要素|verification|verify|暗証番号", Pattern.CASE_INSENSITIVE);
    private NotificationFilter() {}
    static boolean isAllowedPackage(String sender) {
        return "jp.co.smbc.direct".equals(sender) || "com.smbc_card.vpass".equals(sender);
    }
    static boolean isTransactionNotice(String sender, String title, String body) {
        if (!isAllowedPackage(sender) || title == null || body == null || body.trim().isEmpty()) return false;
        String combined = title + "\n" + body;
        return !SENSITIVE.matcher(combined).find() && AMOUNT.matcher(body).find() && TRANSACTION.matcher(combined).find();
    }
    static String sanitize(String value, int limit) {
        if (value == null) return "";
        String clean = value.substring(0, Math.min(value.length(), 4000))
            .replaceAll("(?i)https?://[^\\s]+", "[リンク省略]")
            .replaceAll("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}", "[メール省略]")
            .replaceAll("(?m)^.*(?:氏名|お名前|住所|電話番号|口座番号)[:：].*$", "[個人情報省略]")
            .replaceAll("(?m)^.{1,40}(?:様|さま)\\s*$", "[宛名省略]");
        // Preserve money (including ungrouped ¥100000), redact identifiers only outside amounts.
        Matcher amounts = AMOUNT.matcher(clean);
        StringBuilder safe = new StringBuilder();
        int cursor = 0;
        while (amounts.find()) {
            safe.append(redactIdentifiers(clean.substring(cursor, amounts.start()))).append(amounts.group());
            cursor = amounts.end();
        }
        safe.append(redactIdentifiers(clean.substring(cursor)));
        String result = safe.toString();
        return result.substring(0, Math.min(result.length(), limit));
    }
    private static String redactIdentifiers(String text) {
        return text.replaceAll("(?<![0-9])[0-9]{2,4}[-ー ][0-9]{2,4}[-ー ][0-9]{3,4}(?![0-9])", "[番号省略]")
            .replaceAll("[0-9]{5,}", "[番号省略]");
    }
    static String digest(String value) {
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte item : bytes) hex.append(String.format(java.util.Locale.ROOT, "%02x", item & 255));
            return hex.toString();
        } catch (java.security.NoSuchAlgorithmException error) { throw new IllegalStateException(error); }
    }
}
