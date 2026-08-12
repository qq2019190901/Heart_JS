package com.heartjs.game;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        startPeerServer();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        stopPeerServer();
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
