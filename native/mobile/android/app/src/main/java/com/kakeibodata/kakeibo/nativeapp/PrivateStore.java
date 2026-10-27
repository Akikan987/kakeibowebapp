package com.kakeibodata.kakeibo.nativeapp;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** App-private ciphertext with a separate, non-exportable Keystore key per purpose. */
final class PrivateStore {
    final SharedPreferences preferences;
    private final String alias;
    PrivateStore(Context context, String purpose) {
        preferences = context.getSharedPreferences("native_cipher_" + purpose, Context.MODE_PRIVATE);
        alias = "kakeibo.native." + purpose + ".aes.v1";
    }
    String read(String name) {
        try {
            String value = preferences.getString(name, null);
            if (value == null) return null;
            byte[] bytes = Base64.decode(value, Base64.NO_WRAP);
            if (bytes.length < 28) throw new IllegalArgumentException();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Arrays.copyOfRange(bytes, 0, 12)));
            cipher.updateAAD(name.getBytes(StandardCharsets.UTF_8));
            return new String(cipher.doFinal(Arrays.copyOfRange(bytes, 12, bytes.length)), StandardCharsets.UTF_8);
        } catch (Exception ignored) {
            preferences.edit().remove(name).apply();
            return null;
        }
    }
    void write(String name, String plaintext) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key());
        cipher.updateAAD(name.getBytes(StandardCharsets.UTF_8));
        byte[] encrypted = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
        byte[] bytes = new byte[12 + encrypted.length];
        System.arraycopy(cipher.getIV(), 0, bytes, 0, 12);
        System.arraycopy(encrypted, 0, bytes, 12, encrypted.length);
        if (!preferences.edit().putString(name, Base64.encodeToString(bytes, Base64.NO_WRAP)).commit()) throw new IllegalStateException();
    }
    void clear() {
        preferences.edit().clear().commit();
        try {
            KeyStore store = KeyStore.getInstance("AndroidKeyStore");
            store.load(null);
            if (store.containsAlias(alias)) store.deleteEntry(alias);
        } catch (Exception ignored) { /* Never log ciphertext or notification contents. */ }
    }
    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(alias)) return (SecretKey) store.getKey(alias, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true).build());
        return generator.generateKey();
    }
}
