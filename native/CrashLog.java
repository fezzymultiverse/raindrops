package com.fezzy.raindrops;

import android.content.Context;

import java.io.File;
import java.io.FileOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.Date;

/** Writes the last uncaught crash to files/crash.log so the app can show it on the next launch. */
final class CrashLog {
    private CrashLog() {}

    static File file(Context c) { return new File(c.getFilesDir(), "crash.log"); }

    static void write(Context c, Thread t, Throwable e) {
        try {
            StringWriter sw = new StringWriter();
            e.printStackTrace(new PrintWriter(sw));
            String s = new Date() + " thread=" + t.getName() + "\n" + sw;
            if (s.length() > 6000) s = s.substring(0, 6000);
            try (FileOutputStream os = new FileOutputStream(file(c), false)) { os.write(s.getBytes("UTF-8")); }
        } catch (Throwable ignored) {
        }
    }

    static String read(Context c) {
        try {
            File f = file(c);
            if (!f.exists()) return "";
            byte[] b = new byte[(int) Math.min(f.length(), 8000)];
            try (java.io.FileInputStream in = new java.io.FileInputStream(f)) { int n = in.read(b); return new String(b, 0, Math.max(0, n), "UTF-8"); }
        } catch (Throwable e) {
            return "";
        }
    }

    static void clear(Context c) { try { file(c).delete(); } catch (Throwable ignored) { } }

    /** V1.9.7: record a non-fatal native problem (service refused, WebView renderer lost) so the next launch shows it. */
    static void note(Context c, String msg) {
        try {
            String s = new Date() + " NOTE\n" + msg + "\n";
            try (FileOutputStream os = new FileOutputStream(file(c), false)) { os.write(s.getBytes("UTF-8")); }
        } catch (Throwable ignored) {
        }
    }
}
