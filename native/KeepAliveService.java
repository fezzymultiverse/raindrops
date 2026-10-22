package com.fezzy.raindrops;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

/** V1.9.7: startForeground is the very first thing done, with three fallbacks, so Android 14 cannot kill the app with "did not call startForeground". */
public class KeepAliveService extends Service {
    private static final String CH = "raindrops_keepalive";
    static volatile boolean running = false;
    private PowerManager.WakeLock wl;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        running = true;
    }

    private int smallIcon() {
        try {
            int id = getResources().getIdentifier("ic_stat_raindrop", "drawable", getPackageName());
            if (id != 0) return id;
        } catch (Throwable ignored) {
        }
        int ic = getApplicationInfo().icon;
        return ic != 0 ? ic : android.R.drawable.ic_media_play;
    }

    private Notification build(String text) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null) {
            try {
                nm.createNotificationChannel(new NotificationChannel(CH, "Raindrops running", NotificationManager.IMPORTANCE_LOW));
            } catch (Throwable ignored) {
            }
        }
        PendingIntent pi = null;
        try {
            Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (open != null) pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        } catch (Throwable ignored) {
        }
        return new NotificationCompat.Builder(this, CH)
                .setContentTitle("Raindrops")
                .setContentText(text)
                .setSmallIcon(smallIcon())
                .setOngoing(true)
                .setContentIntent(pi)
                .build();
    }

    private boolean goForeground(Notification n, boolean wantMic) {
        if (Build.VERSION.SDK_INT >= 29) {
            int type = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK;
            if (wantMic && ContextCompat.checkSelfPermission(this, android.Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                type |= ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
            }
            try {
                startForeground(7701, n, type);
                return true;
            } catch (Throwable e1) {
                try {
                    startForeground(7701, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
                    return true;
                } catch (Throwable e2) {
                    // fall through to the untyped call
                }
            }
        }
        try {
            startForeground(7701, n);
            return true;
        } catch (Throwable e3) {
            return false;
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String mode = intent != null ? intent.getStringExtra("mode") : "play";
        boolean rec = "record".equals(mode);
        Notification n;
        try {
            n = build(rec ? "Recording" : "live".equals(mode) ? "Running in background" : "Playing");
        } catch (Throwable e) {
            n = new Notification();
        }
        if (!goForeground(n, rec)) {
            // Could not become a foreground service. Stop quietly; the plugin only starts us while the app is visible, so this is rare.
            try { CrashLog.note(getApplicationContext(), "KeepAliveService could not start foreground (mode=" + mode + ", sdk=" + Build.VERSION.SDK_INT + ")"); } catch (Throwable ignored) { }
            stopSelf();
            return START_NOT_STICKY;
        }
        try {
            if (wl == null) {
                PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
                if (pm != null) {
                    wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Raindrops:keepalive");
                    wl.setReferenceCounted(false);
                    wl.acquire(12 * 60 * 60 * 1000L);
                }
            } else if (!wl.isHeld()) {
                wl.acquire(12 * 60 * 60 * 1000L);
            }
        } catch (Throwable ignored) {
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        try {
            if (wl != null && wl.isHeld()) wl.release();
        } catch (Exception ignored) {
        }
        wl = null;
        super.onDestroy();
    }
}
