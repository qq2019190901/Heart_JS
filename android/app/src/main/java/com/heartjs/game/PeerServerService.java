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

import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * In-process PeerJS signaling server for Android.
 * Listens on ws://0.0.0.0:9000/peerjs and routes messages between connected peers.
 */
public class PeerServerService extends Service {
    private static final String TAG = "PeerServerService";
    private static final String CHANNEL_ID = "heartjs_peer_server";
    private static final int NOTIFICATION_ID = 1001;
    private static final int PORT = 9000;
    private static final String KEY = "peerjs";

    private PeerJSServer server;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private volatile boolean isRunning = false;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, getNotification());

        String localIp = getLocalIpAddress();
        Log.d(TAG, "Service starting. IP: " + localIp + " on port " + PORT);
        isRunning = true;
        startServer(localIp);
    }

    private void startServer(String localIp) {
        try {
            server = new PeerJSServer(new InetSocketAddress(InetAddress.getByName("0.0.0.0"), PORT));
            server.start();
            Log.d(TAG, "PeerJS server started on ws://" + localIp + ":" + PORT + "/peerjs");
            startCleanup();
        } catch (Exception e) {
            Log.e(TAG, "Failed to start server: " + e.getMessage(), e);
        }
    }

    /**
     * Handles a message from a connected peer and routes it to the destination peer.
     */
    private void handleMessage(String message, WebSocket conn) {
        try {
            org.json.JSONObject msg = new org.json.JSONObject(message);
            String type = msg.optString("type", "");
            String src = msg.optString("src", "");
            String dst = msg.optString("dst", "");

            Log.d(TAG, "Msg: type=" + type + " src=" + src + " dst=" + dst);

            switch (type) {
                case "LEAVE":
                    handleLeave(src, dst, conn);
                    break;
                case "HEARTBEAT":
                    handleHeartbeat(src, conn);
                    break;
                default:
                    // Forward offer/answer/candidate to destination peer
                    forwardMessage(dst, src, message);
                    break;
            }
        } catch (org.json.JSONException e) {
            Log.e(TAG, "Bad JSON: " + e.getMessage());
        }
    }

    /**
     * Forwards a message from src to dst.
     * If dst is not connected, queues the message for later delivery.
     */
    private void forwardMessage(String dstId, String srcId, String message) {
        if (dstId == null || dstId.isEmpty()) {
            Log.w(TAG, "Forward message with empty dstId, ignoring");
            return;
        }
        WebSocket target = server != null ? server.getPeer(dstId) : null;
        if (target != null) {
            try {
                target.send(message);
                Log.d(TAG, "Forwarded msg to " + dstId);
            } catch (Exception e) {
                Log.e(TAG, "Send failed to " + dstId + ": " + e.getMessage());
                if (server != null) server.queueMessage(dstId, message);
            }
        } else {
            Log.d(TAG, "Peer " + dstId + " offline, queuing");
            if (server != null) server.queueMessage(dstId, message);
        }
    }

    private void handleLeave(String srcId, String dstId, WebSocket senderConn) {
        if (dstId == null || dstId.isEmpty()) {
            // src is leaving entirely — close their connection
            if (server != null) server.removePeer(srcId);
            if (senderConn != null && senderConn.isOpen()) {
                try { senderConn.close(); } catch (Exception ignored) {}
            }
            Log.d(TAG, "Peer " + srcId + " disconnected");
            return;
        }
        // Notify dst that src left
        WebSocket dstPeer = server != null ? server.getPeer(dstId) : null;
        if (dstPeer != null) {
            try {
                dstPeer.send("{\"type\":\"LEAVE\",\"src\":\"" + srcId + "\",\"dst\":\"" + dstId + "\"}");
            } catch (Exception e) {
                Log.e(TAG, "Send LEAVE failed: " + e.getMessage());
            }
        }
        if (server != null) server.removePeer(srcId);
        Log.d(TAG, "Peer " + srcId + " left session");
    }

    private void handleHeartbeat(String srcId, WebSocket conn) {
        // No-op in our implementation
    }

    private void startCleanup() {
        scheduler.scheduleAtFixedRate(() -> {
            if (!isRunning || server == null) return;
            server.cleanupStaleMessages();
        }, 5000, 5000, TimeUnit.MILLISECONDS);
    }

    private String getLocalIpAddress() {
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                for (InetAddress addr : Collections.list(ni.getInetAddresses())) {
                    if (!addr.isLoopbackAddress() && addr instanceof Inet4Address) {
                        return addr.getHostAddress();
                    }
                }
            }
        } catch (SocketException e) {
            Log.e(TAG, "Error getting IP: " + e.getMessage());
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
                    CHANNEL_ID, "Peer Server", NotificationManager.IMPORTANCE_LOW);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        isRunning = false;
        scheduler.shutdownNow();
        if (server != null) {
            try { server.stop(); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            server = null;
        }
        Log.d(TAG, "Service destroyed");
        super.onDestroy();
    }

    public String getServerIp() { return getLocalIpAddress(); }
    public int getServerPort() { return PORT; }

    // ─── PeerJS Server Implementation ────────────────────────────────────────

    private class PeerJSServer extends WebSocketServer {
        private final ConcurrentHashMap<String, WebSocket> peers = new ConcurrentHashMap<>();
        private final ConcurrentHashMap<String, java.util.ArrayDeque<String>> queues = new ConcurrentHashMap<>();

        public PeerJSServer(InetSocketAddress address) {
            super(address);
        }

        @Override
        public void onOpen(WebSocket conn, ClientHandshake handshake) {
            String uri = handshake.getResourceDescriptor();
            String peerId = extractParam(uri, "id");
            String token = extractParam(uri, "token");
            String key = extractParam(uri, "key");

            Log.d(TAG, "Client connecting. URI: " + uri);

            if (peerId == null || token == null || key == null) {
                Log.w(TAG, "Missing params (id/token/key), rejecting");
                conn.close();
                return;
            }
            if (!KEY.equals(key)) {
                conn.send("{\"type\":\"ERROR\",\"payload\":{\"msg\":\"Invalid key provided\"}}");
                conn.close();
                return;
            }
            if (peers.containsKey(peerId)) {
                conn.send("{\"type\":\"ID-TAKEN\",\"payload\":{\"msg\":\"ID is taken\"}}");
                conn.close();
                return;
            }

            peers.put(peerId, conn);
            queues.putIfAbsent(peerId, new java.util.ArrayDeque<>());

            // Flush queued messages for this peer
            java.util.ArrayDeque<String> q = queues.remove(peerId);
            if (q != null) {
                String m;
                while ((m = q.poll()) != null) {
                    try { conn.send(m); } catch (Exception ignored) {}
                }
            }

            conn.send("{\"type\":\"OPEN\"}");
            Log.d(TAG, "Peer registered: " + peerId + " (total: " + peers.size() + ")");
        }

        @Override
        public void onClose(WebSocket conn, int code, String reason, boolean remote) {
            // Find and remove by scanning (no direct ID-to-conn map lookup from WebSocketServer)
            String removedId = findPeerId(conn);
            if (removedId != null) {
                peers.remove(removedId);
                queues.remove(removedId);
                Log.d(TAG, "Peer closed: " + removedId + " code=" + code);

                // Notify all peers about the disconnection
                for (Map.Entry<String, WebSocket> entry : peers.entrySet()) {
                    try {
                        entry.getValue().send(
                                "{\"type\":\"LEAVE\",\"src\":\"" + removedId + "\",\"dst\":\"" + entry.getKey() + "\"}");
                    } catch (Exception ignored) {}
                }
            }
        }

        @Override
        public void onMessage(WebSocket conn, String message) {
            String senderId = findPeerId(conn);
            if (senderId == null) {
                Log.w(TAG, "Message from unregistered client, ignoring");
                return;
            }
            handleMessage(message, conn);
        }

        @Override
        public void onError(WebSocket conn, Exception ex) {
            if (ex != null) Log.e(TAG, "WebSocket error: " + ex.getMessage());
            if (conn != null) conn.close();
        }

        @Override
        public void onStart() {
            Log.d(TAG, "PeerJS server started on port " + getPort());
        }

        // ─── Peer management ────────────────────────────────────────────────

        public WebSocket getPeer(String id) {
            return peers.get(id);
        }

        public void removePeer(String id) {
            WebSocket conn = peers.remove(id);
            queues.remove(id);
            if (conn != null && conn.isOpen()) {
                try { conn.close(); } catch (Exception ignored) {}
            }
        }

        public void queueMessage(String dstId, String message) {
            queues.computeIfAbsent(dstId, k -> new java.util.ArrayDeque<>()).add(message);
        }

        public void cleanupStaleMessages() {
            for (java.util.ArrayDeque<String> q : queues.values()) {
                while (q.size() > 50) q.poll();
            }
        }

        private String findPeerId(WebSocket conn) {
            for (Map.Entry<String, WebSocket> entry : peers.entrySet()) {
                if (entry.getValue() == conn) return entry.getKey();
            }
            return null;
        }

        private String extractParam(String uri, String paramName) {
            if (uri == null) return null;
            int idx = uri.indexOf('?' + paramName + '=');
            if (idx < 0) return null;
            idx += paramName.length() + 2;
            int amp = uri.indexOf('&', idx);
            return amp < 0 ? uri.substring(idx) : uri.substring(idx, amp);
        }
    }
}
