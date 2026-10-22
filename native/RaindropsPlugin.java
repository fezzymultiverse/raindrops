package com.fezzy.raindrops;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.util.List;

/** Raindrops YouTube plugin (NewPipe Extractor): ytSearch, ytGet, ytClean + ytProgress event. */
@CapacitorPlugin(name = "Raindrops")
public class RaindropsPlugin extends Plugin {

    private static String msg(Throwable e) {
        return e.getMessage() == null ? e.toString() : e.getMessage();
    }

    @PluginMethod
    public void ytSearch(final PluginCall c) {
        final String q = c.getString("q", "");
        final String kind = c.getString("kind", "videos");
        final int lim = Math.max(1, Math.min(60, c.getInt("limit", 30)));
        if (q.trim().isEmpty()) { c.reject("empty search"); return; }
        new Thread(() -> {
            try {
                List<String[]> l = YtFetch.search(q.trim(), kind, lim);
                JSArray a = new JSArray();
                for (String[] e : l) {
                    JSObject o = new JSObject();
                    o.put("url", e[0]); o.put("title", e[1]); o.put("by", e[2]);
                    o.put("dur", Long.parseLong(e[3])); o.put("views", Long.parseLong(e[4]));
                    o.put("thumb", e[5]); o.put("type", e[6]); o.put("count", Long.parseLong(e[7]));
                    a.put(o);
                }
                JSObject r = new JSObject();
                r.put("items", a);
                c.resolve(r);
            } catch (Throwable e) {
                c.reject("search failed: " + msg(e));
            }
        }).start();
    }

    @PluginMethod
    public void ytGet(final PluginCall c) {
        final String url = c.getString("url", "");
        if (url.isEmpty()) { c.reject("no url"); return; }
        new Thread(() -> {
            try {
                YtFetch.Result r = YtFetch.runCache(getContext(), url, (p, m) -> {
                    JSObject o = new JSObject();
                    o.put("p", p); o.put("msg", m);
                    notifyListeners("ytProgress", o);
                });
                JSObject o = new JSObject();
                o.put("path", r.path); o.put("name", r.name); o.put("size", r.size); o.put("mime", r.mime);
                o.put("title", r.title); o.put("artist", r.artist); o.put("art", r.art); o.put("artErr", r.artErr);
                c.resolve(o);
            } catch (Throwable e) {
                c.reject("yt failed: " + msg(e));
            }
        }).start();
    }

    @PluginMethod
    public void ytClean(PluginCall c) {
        try {
            String p = c.getString("path", "");
            File dir = new File(getContext().getCacheDir(), "yt");
            if (!p.isEmpty()) {
                File f = new File(p);
                if (f.getCanonicalPath().startsWith(dir.getCanonicalPath() + File.separator)) f.delete();
            }
        } catch (Throwable ignored) {
        }
        c.resolve();
    }
}
