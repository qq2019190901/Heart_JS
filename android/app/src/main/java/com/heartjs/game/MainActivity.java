package com.heartjs.game;

import android.annotation.SuppressLint;
import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Collections;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private static final String PREFS_NAME = "heartjs_prefs";
    private static final String KEY_LOCAL_IP = "local_ip";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Compute and cache local WiFi IP at startup
        String localIp = getLocalWifiIp();
        cacheLocalIp(localIp);
        Log.d(TAG, "Local IP detected: " + localIp);

        // Set IP as a WebView extras so it's available to JS after page loads
        getBridge().getWebView().getSettings().setJavaScriptEnabled(true);
        getBridge().getWebView().getSettings().setMixedContentMode(
            WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        // Expose native methods to JavaScript
        getBridge().getWebView().addJavascriptInterface(new AndroidBridge(), "AndroidBridge");

        // Inject IP and server port into JS after the page finishes loading
        getBridge().getWebView().setWebChromeClient(new android.webkit.WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress == 100) {
                    int serverPort = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                            .getInt("server_port", -1);
                    view.evaluateJavascript(
                        "window.__localIp='" + localIp + "';"
                        + "window.__serverPort=" + serverPort + ";"
                        + "window.dispatchEvent(new Event('localIpReady'));",
                        null);
                }
            }
        });

        // Hide status bar and navigation bar
        hideSystemUI();

        startPeerServer();
    }

    @Override
    public void onResume() {
        super.onResume();
        // Refresh IP in case network changed
        String localIp = getLocalWifiIp();
        cacheLocalIp(localIp);
    }

    /** Get non-loopback IPv4 address from active network interfaces. */
    private String getLocalWifiIp() {
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                for (InetAddress addr : Collections.list(ni.getInetAddresses())) {
                    if (!addr.isLoopbackAddress() && addr instanceof Inet4Address) {
                        return addr.getHostAddress();
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error getting IP: " + e.getMessage());
        }
        return "127.0.0.1";
    }

    private void cacheLocalIp(String ip) {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_LOCAL_IP, ip).apply();
    }

    /** Called from JavaScript via addJavascriptInterface to get the cached local IP. */
    @SuppressLint("JavascriptInterface")
    public class AndroidBridge {
        @JavascriptInterface
        public String getLocalIp() {
            SharedPreferences prefs = getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            return prefs.getString(KEY_LOCAL_IP, "127.0.0.1");
        }
        @JavascriptInterface
        public int getServerPort() {
            SharedPreferences prefs = getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            return prefs.getInt("server_port", -1);
        }
    }

    /** Hide system UI (status bar + navigation bar) for fullscreen experience */
    private void hideSystemUI() {
        int uiOptions = View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            uiOptions |= View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        getWindow().getDecorView().setSystemUiVisibility(uiOptions);
        getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);
        getWindow().setNavigationBarColor(android.graphics.Color.TRANSPARENT);
    }

    private void startPeerServer() {
        Intent intent = new Intent(this, PeerServerService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent);
        } else {
            startService(intent);
        }
        Log.d(TAG, "Starting PeerServerService");
    }

    private void stopPeerServer() {
        Intent intent = new Intent(this, PeerServerService.class);
        stopService(intent);
        Log.d(TAG, "Stopping PeerServerService");
    }
}
