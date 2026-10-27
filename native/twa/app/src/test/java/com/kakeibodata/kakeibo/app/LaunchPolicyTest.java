package com.kakeibodata.kakeibo.app;

import org.junit.Test;
import static org.junit.Assert.assertEquals;

public class LaunchPolicyTest {
    @Test public void homeAndShortcutsKeepExistingWebRoutes() {
        for (String input : new String[]{LaunchPolicy.HOME, LaunchPolicy.HOME + "?shortcut=add-expense", LaunchPolicy.HOME + "?shortcut=add-income", LaunchPolicy.HOME + "?shortcut=withdrawals", LaunchPolicy.HOME + "?gmail=candidates"})
            assertEquals(input, LaunchPolicy.trustedLaunchUrl(input));
    }
    @Test public void externalAndInternalFileOriginsAreRejected() {
        for (String input : new String[]{null, "", "https://evil.example/", "https://app.kakeibodata.com.evil.example/", "http://app.kakeibodata.com/", "https://app.kakeibodata.com:8443/", "https://evil@app.kakeibodata.com/", "file:///data/private", "content://private/data", "javascript:alert(1)", "intent://test", "https://app.kakeibodata.com/\n", "https://app.kakeibodata.com/%2f", "https://app.kakeibodata.com/auth/social/google/callback", "x".repeat(4097)})
            assertEquals(LaunchPolicy.HOME, LaunchPolicy.trustedLaunchUrl(input));
    }
    @Test public void httpsOriginMayUseStandardPortAndCase() {
        assertEquals("https://APP.KAKEIBODATA.COM:443/", LaunchPolicy.trustedLaunchUrl("https://APP.KAKEIBODATA.COM:443/"));
    }
}
