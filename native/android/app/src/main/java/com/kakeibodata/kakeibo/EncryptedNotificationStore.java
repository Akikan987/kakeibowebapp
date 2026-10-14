package com.kakeibodata.kakeibo;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

final class EncryptedNotificationStore {
    static final int MAX_EVENTS = 50;
    static final long MAX_AGE_MS = 7L * 24 * 60 * 60 * 1000;
    private static final String KEY_ALIAS = "kakeibo.bank-notices.aes";
    private static final Object LOCK = new Object();
    private final SharedPreferences preferences;
    private final SharedPreferences controlPreferences;

    EncryptedNotificationStore(Context context) {
        preferences = context.getSharedPreferences("bank_notice_ciphertext_v1", Context.MODE_PRIVATE);
        controlPreferences = context.getSharedPreferences(MainActivity.PREFS_NAME, Context.MODE_PRIVATE);
    }

    int count() {
        synchronized (LOCK) { return readEvents().size(); }
    }

    void add(String packageName, String title, String body, long postedAt) {
        synchronized (LOCK) {
        if (!controlPreferences.getBoolean(MainActivity.PREF_ENABLED, false)) return;
        List<JSONObject> events = readEvents();
        String id = UUID.randomUUID().toString();
        JSONObject event = new JSONObject();
        try {
            event.put("id", id);
            event.put("packageName", packageName);
            event.put("title", cap(title, 256));
            event.put("text", cap(body, 2000));
            event.put("postedAt", postedAt > 0 ? postedAt : System.currentTimeMillis());
            String encrypted = encrypt(event.toString());
            events.add(event);
            events.sort(Comparator.comparingLong(value -> value.optLong("postedAt")));
            while (events.size() > MAX_EVENTS) events.remove(0);
            persist(events);
            preferences.edit().putString("event:" + id, encrypted).apply();
        } catch (Exception ignored) {
            // Notification contents are intentionally never logged or written in plaintext.
        }
        }
    }

    JSONArray readPending() {
        synchronized (LOCK) {
        List<JSONObject> events = readEvents();
        JSONArray result = new JSONArray();
        for (JSONObject event : events) result.put(event);
        return result;
        }
    }

    int acknowledge(JSONArray ids) {
        synchronized (LOCK) {
        if (ids == null) return 0;
        SharedPreferences.Editor editor = preferences.edit();
        int removed = 0;
        for (int index = 0; index < ids.length(); index++) {
            String id = ids.optString(index, "");
            if (isOpaqueId(id) && preferences.contains("event:" + id)) {
                editor.remove("event:" + id);
                removed++;
            }
        }
        editor.apply();
        return removed;
        }
    }

    void clear() {
        synchronized (LOCK) {
        preferences.edit().clear().apply();
        try {
            KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
            keyStore.load(null);
            if (keyStore.containsAlias(KEY_ALIAS)) keyStore.deleteEntry(KEY_ALIAS);
        } catch (Exception ignored) { }
        }
    }

    private List<JSONObject> readEvents() {
        List<JSONObject> events = new ArrayList<>();
        long cutoff = System.currentTimeMillis() - MAX_AGE_MS;
        SharedPreferences.Editor prune = preferences.edit();
        boolean changed = false;
        for (String key : preferences.getAll().keySet()) {
            if (!key.startsWith("event:")) continue;
            String id = key.substring("event:".length());
            try {
                String ciphertext = preferences.getString(key, null);
                JSONObject event = new JSONObject(decrypt(ciphertext));
                if (!isOpaqueId(id) || !id.equals(event.optString("id")) || event.optLong("postedAt") < cutoff) {
                    prune.remove(key);
                    changed = true;
                } else {
                    events.add(event);
                }
            } catch (Exception ignored) {
                prune.remove(key);
                changed = true;
            }
        }
        events.sort(Comparator.comparingLong(value -> value.optLong("postedAt")));
        while (events.size() > MAX_EVENTS) {
            JSONObject old = events.remove(0);
            prune.remove("event:" + old.optString("id"));
            changed = true;
        }
        if (changed) prune.apply();
        return events;
    }

    private void persist(List<JSONObject> events) {
        java.util.Set<String> keep = new java.util.HashSet<>();
        for (JSONObject event : events) keep.add("event:" + event.optString("id"));
        SharedPreferences.Editor editor = preferences.edit();
        for (String key : preferences.getAll().keySet()) {
            if (key.startsWith("event:") && !keep.contains(key)) editor.remove(key);
        }
        editor.apply();
    }

    private static String cap(String value, int max) {
        if (value == null) return "";
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static boolean isOpaqueId(String id) {
        try {
            return UUID.fromString(id).toString().equals(id);
        } catch (RuntimeException exception) {
            return false;
        }
    }

    private static SecretKey getKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) {
            return ((SecretKey) keyStore.getKey(KEY_ALIAS, null));
        }
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build());
        return generator.generateKey();
    }

    private static String encrypt(String plaintext) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, getKey());
        byte[] encrypted = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
        byte[] iv = cipher.getIV();
        byte[] combined = new byte[iv.length + encrypted.length];
        System.arraycopy(iv, 0, combined, 0, iv.length);
        System.arraycopy(encrypted, 0, combined, iv.length, encrypted.length);
        return Base64.encodeToString(combined, Base64.NO_WRAP);
    }

    private static String decrypt(String value) throws Exception {
        byte[] combined = Base64.decode(value, Base64.NO_WRAP);
        int ivLength = 12;
        byte[] iv = java.util.Arrays.copyOfRange(combined, 0, ivLength);
        byte[] encrypted = java.util.Arrays.copyOfRange(combined, ivLength, combined.length);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, getKey(), new GCMParameterSpec(128, iv));
        return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
    }
}
