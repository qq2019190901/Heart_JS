package com.heartjs.game;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Collections;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

public class PeerServerService extends Service {
    private static final String CHANNEL_ID = "heartjs_peer_server";
    private static final int NOTIFICATION_ID = 1001;
    private static final int PORT = 9000;

    private OkHttpClient client;
    private Map<String, WebSocket> peers = new ConcurrentHashMap<>();
    private String myId;
    private WebSocket serverSocket;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, getNotification());

        client = new OkHttpClient.Builder()
                .readTimeout(0, java.util.concurrent.TimeUnit.MILLISECONDS)
                .writeTimeout(0, java.util.concurrent.TimeUnit.MILLISECONDS)
                .build();

        myId = UUID.randomUUID().toString().substring(0, 8);
        Log.d("PeerServer", "Service started. My ID: " + myId);
        startPeerServer();
    }

    private void startPeerServer() {
        String localIp = getLocalIpAddress();
        String url = "ws://" + localIp + ":" + PORT + "/peerjs";

        Request request = new Request.Builder().url(url).build();

        serverSocket = client.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket ws, Response response) {
                Log.d("PeerServer", "Server socket opened");
                serverSocket = ws;
            }

            @Override
            public void onMessage(WebSocket ws, String text) {
                Log.d("PeerServer", "Message: " + text);
                handleMessage(text);
            }

            @Override
            public void onFailure(WebSocket ws, Throwable t, Response response) {
                Log.e("PeerServer", "Server error: " + t.getMessage());
                t.printStackTrace();
            }
        });
    }

    private void handleMessage(String message) {
        try {
            // Simple message routing - in real implementation, parse JSON and route to peers
            Log.d("PeerServer", "Relaying message: " + message);
            for (Map.Entry<String, WebSocket> entry : peers.entrySet()) {
                if (!entry.getKey().equals(myId)) {
                    entry.getValue().send(message);
                }
            }
        } catch (Exception e) {
            Log.e("PeerServer", "Error handling message: " + e.getMessage());
        }
    }

    public String getMyId() {
        return myId;
    }

    public String getLocalIpAddress() {
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                for (InetAddress addr : Collections.list(ni.getInetAddresses())) {
                    if (!addr.isLoopbackAddress() && addr.getHostAddress().contains(".")) {
                        return addr.getHostAddress();
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return "127.0.0.1";
    }

    private Notification getNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("红心大战服务器")
                .setContentText("信令服务器运行中 (端口 " + PORT + ")")
                .setSmallIcon(android.R.drawable.ic_menu_compass)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Peer Server",
                    NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (serverSocket != null) {
            serverSocket.close(1000, "Service stopped");
        }
        client.dispatcher().cancelAll();
        Log.d("PeerServer", "Service destroyed");
    }
}
