package com.mzagaming.mindgrid;

import android.app.Activity;
import android.os.Build;
import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 1.6.2: App Hive tester countdown support.
 * setSecure({on}) blocks screenshots (FLAG_SECURE) during the first seconds of the countdown.
 * On Android 14+ a screenshot attempt fires the "screenshot" event, so the game can say how long to wait.
 */
@CapacitorPlugin(name = "MzaSecure")
public class MzaSecurePlugin extends Plugin {
    private Object captureCallback;

    @PluginMethod
    public void setSecure(PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        final Activity activity = getActivity();
        if (activity == null) { call.resolve(); return; }
        activity.runOnUiThread(() -> {
            if (on) activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            else activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            call.resolve();
        });
    }

    @Override
    protected void handleOnStart() {
        super.handleOnStart();
        if (Build.VERSION.SDK_INT < 34 || getActivity() == null) return;
        try {
            Activity.ScreenCaptureCallback cb = () -> notifyListeners("screenshot", new JSObject());
            getActivity().registerScreenCaptureCallback(getActivity().getMainExecutor(), cb);
            captureCallback = cb;
        } catch (RuntimeException ignored) { captureCallback = null; }
    }

    @Override
    protected void handleOnStop() {
        if (Build.VERSION.SDK_INT >= 34 && captureCallback != null && getActivity() != null) {
            try { getActivity().unregisterScreenCaptureCallback((Activity.ScreenCaptureCallback) captureCallback); } catch (RuntimeException ignored) { }
            captureCallback = null;
        }
        super.handleOnStop();
    }
}
