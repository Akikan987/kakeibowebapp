package com.kakeibodata.kakeibo.nativeapp;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

final class NotificationStore {
    static final long TTL = 7L * 24 * 60 * 60 * 1000;
    private final Context context;
    private final PrivateStore store;
    NotificationStore(Context context) { this.context = context; store = new PrivateStore(context, "notices"); }
    void add(String sender, String title, String text, long postedAt) {
        synchronized (DeviceState.LOCK) {
            if (!DeviceState.enabled(context) || !DeviceState.hasPermission(context)) return;
            long now = System.currentTimeMillis();
            if (postedAt <= 0 || postedAt > now + 60_000 || postedAt < now - TTL) return;
            try {
                JSONObject state = state();
                JSONArray events = state.getJSONArray("events");
                JSONArray seen = state.getJSONArray("seen");
                String cleanTitle = NotificationFilter.sanitize(title, 256);
                String cleanText = NotificationFilter.sanitize(text, 2000);
                String content = NotificationFilter.digest(sender + "\n" + cleanTitle + "\n" + cleanText);
                String exact = NotificationFilter.digest(content + ":" + postedAt);
                // Exact duplicates remain suppressed after ACK. Also coalesce immediate re-posts/updates.
                for (int i = 0; i < seen.length(); i++) {
                    JSONObject old = seen.getJSONObject(i);
                    if (exact.equals(old.optString("exact")) || content.equals(old.optString("content")) && Math.abs(postedAt - old.optLong("postedAt")) < 120_000) return;
                }
                events.put(new JSONObject().put("id", UUID.randomUUID().toString()).put("packageName", sender)
                    .put("title", cleanTitle).put("text", cleanText).put("postedAt", postedAt));
                seen.put(new JSONObject().put("exact", exact).put("content", content).put("postedAt", postedAt));
                while (events.length() > 50) events.remove(0);
                while (seen.length() > 200) seen.remove(0);
                store.write("queue", state.toString());
            } catch (Exception ignored) { /* Fail closed, without logging sensitive data. */ }
        }
    }
    JSONArray pending() {
        synchronized (DeviceState.LOCK) {
            try { return state().getJSONArray("events"); } catch (Exception ignored) { return new JSONArray(); }
        }
    }
    int acknowledge(JSONArray ids) throws Exception {
        synchronized (DeviceState.LOCK) {
            if (ids == null || ids.length() > 50) throw new IllegalArgumentException();
            JSONObject value = state();
            JSONArray events = value.getJSONArray("events");
            int removed = 0;
            for (int i = events.length() - 1; i >= 0; i--) {
                for (int j = 0; j < ids.length(); j++) {
                    String id = ids.optString(j);
                    if (!id.matches("[A-Za-z0-9_-]{1,128}")) throw new IllegalArgumentException();
                    if (id.equals(events.getJSONObject(i).optString("id"))) { events.remove(i); removed++; break; }
                }
            }
            store.write("queue", value.toString());
            return removed;
        }
    }
    void clear() { synchronized (DeviceState.LOCK) { store.clear(); } }
    void prune() { synchronized (DeviceState.LOCK) { try { state(); } catch (Exception ignored) { clear(); } } }
    private JSONObject state() throws Exception {
        String raw = store.read("queue");
        JSONObject value = raw == null ? new JSONObject().put("events", new JSONArray()).put("seen", new JSONArray()) : new JSONObject(raw);
        long cutoff = System.currentTimeMillis() - TTL;
        boolean changed = false;
        for (String name : new String[] {"events", "seen"}) {
            JSONArray rows = value.getJSONArray(name);
            List<JSONObject> kept = new ArrayList<>();
            for (int i = 0; i < rows.length(); i++) {
                JSONObject row = rows.getJSONObject(i);
                if (row.optLong("postedAt") >= cutoff) kept.add(row); else changed = true;
            }
            kept.sort(Comparator.comparingLong(row -> row.optLong("postedAt")));
            JSONArray normalized = new JSONArray();
            int bound = "events".equals(name) ? 50 : 200;
            for (int i = Math.max(0, kept.size() - bound); i < kept.size(); i++) normalized.put(kept.get(i));
            value.put(name, normalized);
        }
        if (changed) store.write("queue", value.toString());
        return value;
    }
}
