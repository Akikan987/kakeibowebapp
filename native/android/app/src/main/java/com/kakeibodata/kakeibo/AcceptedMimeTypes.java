package com.kakeibodata.kakeibo;

import java.util.LinkedHashSet;
import java.util.Locale;

final class AcceptedMimeTypes {
    private AcceptedMimeTypes() { }

    static String[] fromAcceptTypes(String[] accepted) {
        LinkedHashSet<String> safe = new LinkedHashSet<>();
        if (accepted != null) {
            for (String entry : accepted) {
                if (entry == null) continue;
                for (String candidate : entry.split(",")) {
                    String value = candidate.trim().toLowerCase(Locale.ROOT);
                    int parameters = value.indexOf(';');
                    if (parameters >= 0) value = value.substring(0, parameters).trim();
                    String mime = extensionMimeType(value);
                    if (mime == null && isSupportedMimeType(value)) mime = value;
                    if (mime != null) safe.add(mime);
                }
            }
        }
        return safe.toArray(new String[0]);
    }

    private static String extensionMimeType(String value) {
        switch (value) {
            case ".jpg":
            case ".jpeg": return "image/jpeg";
            case ".png": return "image/png";
            case ".webp": return "image/webp";
            case ".gif": return "image/gif";
            case ".heic": return "image/heic";
            case ".heif": return "image/heif";
            case ".avif": return "image/avif";
            case ".bmp": return "image/bmp";
            case ".txt": return "text/plain";
            case ".csv": return "text/csv";
            case ".json": return "application/json";
            case ".pdf": return "application/pdf";
            default: return null;
        }
    }

    private static boolean isSupportedMimeType(String value) {
        switch (value) {
            case "image/*":
            case "image/jpeg":
            case "image/png":
            case "image/webp":
            case "image/gif":
            case "image/heic":
            case "image/heif":
            case "image/avif":
            case "image/bmp":
            case "text/plain":
            case "text/csv":
            case "application/json":
            case "application/pdf":
                return true;
            default: return false;
        }
    }
}
