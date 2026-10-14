package com.kakeibodata.kakeibo;

import org.junit.Test;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public final class NotificationFilterTest {
    @Test
    public void acceptsOnlyAllowlistedPackagesWithTransactionalAmount() {
        assertTrue(NotificationFilter.isTransactionNotice("jp.co.smbc.direct",
                "SMBCダイレクト", "振込 12,300円"));
        assertFalse(NotificationFilter.isTransactionNotice("com.other.bank",
                "銀行", "振込 12,300円"));
        assertFalse(NotificationFilter.isTransactionNotice("jp.co.smbc.direct",
                "SMBCダイレクト", "新しいお知らせです"));
    }

    @Test
    public void excludesCodesAndLoginNoticesEvenWhenTheyContainAmounts() {
        assertFalse(NotificationFilter.isTransactionNotice("jp.co.smbc.direct",
                "ログイン確認", "確認コード 1234円"));
        assertFalse(NotificationFilter.isTransactionNotice("com.smbc_card.vpass",
                "Vpass", "本人確認のため 1,000円を入力してください"));
    }
}
