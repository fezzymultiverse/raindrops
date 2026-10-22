package PKG;

import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.WebViewListener;

/** V1.9.7: when Android kills the WebView renderer (usually out of memory) Capacitor lets the whole app die, which looks like a restart.
 *  This keeps the app alive, writes the reason to the crash log and rebuilds the screen. prep-android.sh only installs this file when
 *  the Capacitor source in node_modules really contains WebViewListener.onRenderProcessGone, addWebViewListener and getActivity. */
final class RenderGuard {
    private RenderGuard() {}

    static void install(final Bridge bridge) {
        if (bridge == null) return;
        bridge.addWebViewListener(new WebViewListener() {
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                try {
                    boolean crashed = detail != null && detail.didCrash();
                    CrashLog.note(bridge.getContext(), "WebView renderer gone (" + (crashed ? "crashed" : "killed by Android, usually low memory") + "). App kept alive and screen rebuilt.");
                } catch (Throwable ignored) {
                }
                try {
                    final android.app.Activity a = bridge.getActivity();
                    if (a != null) a.runOnUiThread(a::recreate);
                } catch (Throwable ignored) {
                }
                return true;
            }
        });
    }
}
