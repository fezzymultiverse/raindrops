package com.fezzy.raindrops;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
        name = "RaindropsSys",
        permissions = {
                @Permission(strings = {Manifest.permission.RECORD_AUDIO}, alias = "mic")
        }
)
public class RaindropsSysPlugin extends Plugin {

    private volatile boolean visible = true;

    @Override
    protected void handleOnResume() {
        visible = true;
    }

    @Override
    protected void handleOnPause() {
        visible = false;
    }

    @PluginMethod
    public void startKeepAlive(PluginCall call) {
        try {
            Context c = getContext();
            Intent i = new Intent(c, KeepAliveService.class);
            i.putExtra("mode", call.getString("mode", "play"));
            if (visible) {
                ContextCompat.startForegroundService(c, i);
            } else if (KeepAliveService.running) {
                c.startService(i); // already a foreground service: only refreshes the notification text
            } // else: Android 12+ forbids starting a foreground service from the background, so skip instead of crashing
            call.resolve();
        } catch (Throwable e) {
            call.reject("keep-alive failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopKeepAlive(PluginCall call) {
        try {
            Context c = getContext();
            c.stopService(new Intent(c, KeepAliveService.class));
            call.resolve();
        } catch (Exception e) {
            call.reject("stop failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void batteryStatus(PluginCall call) {
        Context c = getContext();
        PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
        JSObject r = new JSObject();
        r.put("ignoring", pm != null && pm.isIgnoringBatteryOptimizations(c.getPackageName()));
        call.resolve(r);
    }

    @PluginMethod
    public void requestIgnoreBattery(PluginCall call) {
        Context c = getContext();
        try {
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            i.setData(Uri.parse("package:" + c.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
            call.resolve();
        } catch (Exception e) {
            try {
                Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                c.startActivity(i);
                call.resolve();
            } catch (Exception e2) {
                call.reject("could not open battery settings: " + e2.getMessage());
            }
        }
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Context c = getContext();
        try {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            i.setData(Uri.parse("package:" + c.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("could not open app settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void lastCrash(PluginCall call) {
        JSObject r = new JSObject();
        r.put("log", CrashLog.read(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void clearCrash(PluginCall call) {
        CrashLog.clear(getContext());
        call.resolve();
    }
}
