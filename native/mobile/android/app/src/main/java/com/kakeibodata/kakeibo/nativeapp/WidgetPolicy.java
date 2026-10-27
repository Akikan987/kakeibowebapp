package com.kakeibodata.kakeibo.nativeapp;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/** Widget validation only. Amount and billing-date calculations stay in shared TypeScript. */
final class WidgetPolicy {
    static final long MAX_SAFE_AMOUNT = 9_007_199_254_740_991L;
    static final long STALE_AFTER = 24L * 60 * 60 * 1000;
    private WidgetPolicy() {}
    static Long jsonInteger(Object value) {
        if (value instanceof Integer || value instanceof Long) return ((Number) value).longValue();
        if (value instanceof Double) {
            double number = (Double) value;
            if (Double.isFinite(number) && number == Math.rint(number) && Math.abs(number) <= MAX_SAFE_AMOUNT) return (long) number;
        }
        return null;
    }
    static boolean amount(Long value) { return value != null && value >= 0 && value <= MAX_SAFE_AMOUNT; }
    static boolean validSnapshot(Long total, Long nextAmount, Long updatedAt, Long lastSync, Long nextDate, String state, String monthKey, long now) {
        return amount(total) && amount(nextAmount) && updatedAt != null && updatedAt > 0 && updatedAt <= now + 300_000
            && lastSync != null && lastSync >= 0 && lastSync <= now + 300_000
            && (nextDate == null || nextDate > 0 && nextDate < 4_102_444_800_000L)
            && ("current".equals(state) || "offline".equals(state) || "error".equals(state))
            && monthKey != null && monthKey.matches("[0-9]{4}-(0[1-9]|1[0-2])");
    }
    static String monthKey(long now) { return DateTimeFormatter.ofPattern("uuuu-MM").withZone(ZoneId.systemDefault()).format(Instant.ofEpochMilli(now)); }
    static boolean stale(long updatedAt, String snapshotMonth, long now, String currentMonth) {
        return updatedAt <= 0 || now - updatedAt >= STALE_AFTER || !currentMonth.equals(snapshotMonth);
    }
    static boolean showAmounts(boolean optedIn, boolean locked, boolean stale) { return optedIn && !locked && !stale; }
}
