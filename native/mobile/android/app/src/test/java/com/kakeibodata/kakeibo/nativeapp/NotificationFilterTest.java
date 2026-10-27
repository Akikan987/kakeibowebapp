package com.kakeibodata.kakeibo.nativeapp;

import org.junit.Test;
import static org.junit.Assert.*;

public class NotificationFilterTest {
    private final String bank = "jp.co.smbc.direct";
    @Test public void onlyExplicitSendersAndAmountsAreAccepted() {
        assertTrue(NotificationFilter.isTransactionNotice(bank, "出金のお知らせ", "買物 1,234円"));
        assertTrue(NotificationFilter.isTransactionNotice("com.smbc_card.vpass", "カード利用", "STORE ¥100000"));
        assertFalse(NotificationFilter.isTransactionNotice("com.attacker.bank", "利用", "1,234円"));
        assertFalse(NotificationFilter.isTransactionNotice(bank, "カード利用", "確認してください"));
        assertFalse(NotificationFilter.isTransactionNotice(bank, "お知らせ", ""));
    }
    @Test public void authenticationTermsBlockEvenWhenThereIsAnAmount() {
        for (String sensitive : new String[] {"OTP", "認証", "ワンタイム", "ログイン", "確認コード", "本人確認", "暗証番号", "Verification"}) {
            assertFalse(sensitive, NotificationFilter.isTransactionNotice(bank, "カード利用", "1,234円 " + sensitive + " 123456"));
            assertFalse(sensitive, NotificationFilter.isTransactionNotice(bank, sensitive, "支払 1,234円"));
        }
    }
    @Test public void redactionKeepsMoneyAndLastFourButRemovesIdentifiers() {
        String safe = NotificationFilter.sanitize("カード利用 ¥100000 / 200000円 / 12,345円 末尾1234 番号123456789 電話090-1234-5678 test@example.com https://example.com/private?code=abc", 2000);
        assertTrue(safe.contains("¥100000"));
        assertTrue(safe.contains("200000円"));
        assertTrue(safe.contains("12,345円"));
        assertTrue(safe.contains("末尾1234"));
        for (String privateValue : new String[] {"123456789", "090-1234-5678", "test@example.com", "https://example.com", "code=abc"}) assertFalse(privateValue, safe.contains(privateValue));
        assertEquals(256, NotificationFilter.sanitize("a".repeat(500), 256).length());
    }
    @Test public void labeledPersonalInformationAndGreetingsAreOmitted() {
        String safe = NotificationFilter.sanitize("山田太郎様\n氏名：山田太郎\n住所:東京都\n利用先 STORE\n1,000円", 2000);
        assertFalse(safe.contains("山田太郎"));
        assertFalse(safe.contains("東京都"));
        assertTrue(safe.contains("利用先 STORE"));
    }
    @Test public void hashesAreDeterministicAndSeparateDistinctEvents() {
        assertEquals(64, NotificationFilter.digest("one").length());
        assertEquals(NotificationFilter.digest("one"), NotificationFilter.digest("one"));
        assertNotEquals(NotificationFilter.digest("one"), NotificationFilter.digest("two"));
    }
}
