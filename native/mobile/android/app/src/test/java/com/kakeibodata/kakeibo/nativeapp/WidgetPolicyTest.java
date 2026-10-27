package com.kakeibodata.kakeibo.nativeapp;

import org.junit.Test;
import static org.junit.Assert.*;

public class WidgetPolicyTest {
    private final long now = 1_800_000_000_000L;
    @Test public void javascriptIntegersAcceptBothJsonIntegerAndLongWithoutTruncation() {
        assertEquals(Long.valueOf(0), WidgetPolicy.jsonInteger(0));
        assertEquals(Long.valueOf(1000), WidgetPolicy.jsonInteger(1000));
        assertEquals(Long.valueOf(now), WidgetPolicy.jsonInteger(now));
        assertEquals(Long.valueOf(1000), WidgetPolicy.jsonInteger(1000.0));
        assertNull(WidgetPolicy.jsonInteger(12.5));
        assertNull(WidgetPolicy.jsonInteger("1000"));
        assertNull(WidgetPolicy.jsonInteger(Double.NaN));
        assertNull(WidgetPolicy.jsonInteger(Double.POSITIVE_INFINITY));
    }
    @Test public void widgetAcceptsOnlyBoundedSnapshotsAndKnownStates() {
        assertTrue(WidgetPolicy.validSnapshot(100L, 0L, now, 0L, null, "offline", "2026-10", now));
        assertFalse(WidgetPolicy.validSnapshot(-1L, 0L, now, 0L, null, "current", "2026-10", now));
        assertFalse(WidgetPolicy.validSnapshot(WidgetPolicy.MAX_SAFE_AMOUNT + 1, 0L, now, 0L, null, "current", "2026-10", now));
        assertFalse(WidgetPolicy.validSnapshot(0L, null, now, 0L, null, "current", "2026-10", now));
        assertFalse(WidgetPolicy.validSnapshot(0L, 0L, now + 300_001, 0L, null, "current", "2026-10", now));
        assertFalse(WidgetPolicy.validSnapshot(0L, 0L, now, now + 300_001, null, "current", "2026-10", now));
        assertFalse(WidgetPolicy.validSnapshot(0L, 0L, now, 0L, -1L, "current", "2026-10", now));
        assertFalse(WidgetPolicy.validSnapshot(0L, 0L, now, 0L, null, "syncing-forever", "2026-10", now));
        assertFalse(WidgetPolicy.validSnapshot(0L, 0L, now, 0L, null, "current", "2026-13", now));
    }
    @Test public void monthRolloverAndOldSnapshotsCannotRevealAmounts() {
        assertFalse(WidgetPolicy.stale(now, "2026-10", now, "2026-10"));
        assertTrue(WidgetPolicy.stale(now, "2026-10", now, "2026-11"));
        assertTrue(WidgetPolicy.stale(now - WidgetPolicy.STALE_AFTER, "2026-10", now, "2026-10"));
        assertFalse(WidgetPolicy.showAmounts(false, false, false));
        assertFalse(WidgetPolicy.showAmounts(true, true, false));
        assertFalse(WidgetPolicy.showAmounts(true, false, true));
        assertTrue(WidgetPolicy.showAmounts(true, false, false));
    }
}
