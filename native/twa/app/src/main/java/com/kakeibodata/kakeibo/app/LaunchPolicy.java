package com.kakeibodata.kakeibo.app;

import java.net.URI;

/** Untrusted Intent data must never select a different web origin or internal file. */
public final class LaunchPolicy {
    public static final String HOME = "https://app.kakeibodata.com/";
    private LaunchPolicy() { }

    public static String trustedLaunchUrl(String input) {
        if (input == null || input.length() > 4096 || input.chars().anyMatch(c -> c < 32 || c == 127)) return HOME;
        try {
            URI uri = new URI(input);
            if (!"https".equalsIgnoreCase(uri.getScheme())
                    || !"app.kakeibodata.com".equalsIgnoreCase(uri.getHost())
                    || uri.getRawUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443)
                    || !(uri.getRawPath().isEmpty() || "/".equals(uri.getRawPath()))) return HOME;
            return uri.toASCIIString();
        } catch (Exception ignored) {
            return HOME;
        }
    }
}
