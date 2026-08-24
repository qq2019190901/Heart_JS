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

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import fi.iki.elonen.NanoHTTPD;
import fi.iki.elonen.NanoWSD;
import fi.iki.elonen.NanoHTTPD.IHTTPSession;
import fi.iki.elonen.NanoWSD.WebSocketFrame;

/**
 * In-process PeerJS signaling server for Android.
 *
 * Mirrors electron/peer-server.ts: serves BOTH the HTTP discovery endpoints
 * (GET /peerjs/id, /peerjs/port, /peerjs/key) and the WebSocket upgrade on the
 * same port, so PeerJS clients can retrieve an ID and establish the signaling
 * connection exactly as they do against the EXE.
 */
public class PeerServerService extends Service {
    private static final String TAG = "PeerServerService";
    private static final String CHANNEL_ID = "heartjs_peer_server";
    private static final int NOTIFICATION_ID = 1001;
    private static final int PORT = 9000;
    private static final int PORT_FALLBACK = 9001;
    private static final String KEY = "peerjs";

    private static final String PREFS_NAME = "heartjs_prefs";
    private static final String KEY_SERVER_PORT = "server_port";

    private PeerServer server;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private volatile boolean isRunning = false;
    private volatile int actualPort = PORT;

    // Peer registry and per-peer message queues (offline messages)
    private final ConcurrentHashMap<String, PeerWs> peers = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, java.util.ArrayDeque<String>> queues = new ConcurrentHashMap<>();

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
        int[] portsToTry = {PORT, PORT_FALLBACK};
        for (int port : portsToTry) {
            try {
                server = new PeerServer(port);
                server.start(5000, true); // daemon=true → background thread, non-blocking
                actualPort = port;
                Log.d(TAG, "PeerJS server started on port " + port
                        + " (localIp=" + localIp + ")");
                saveServerPort();
                startCleanup();
                return;
            } catch (Exception e) {
                Log.d(TAG, "Port " + port + " occupied: " + e.getMessage()
                        + " — trying " + PORT_FALLBACK);
                server = null;
            }
        }
        actualPort = -1;
        saveServerPort();
        Log.e(TAG, "Failed to start server on any port (tried " + PORT + "," + PORT_FALLBACK + ")");
    }

    private void saveServerPort() {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .edit()
                .putInt(KEY_SERVER_PORT, actualPort)
                .apply();
    }

    // ─── HTTP + WebSocket server (NanoWSD) ────────────────────────────────

    private class PeerServer extends NanoWSD {
        PeerServer(int port) {
            super(port);
        }

        /** WebSocket upgrade request → create a PeerWs; validation happens in onOpen(). */
        @Override
        protected WebSocket openWebSocket(IHTTPSession handshake) {
            Map<String, String> parms = handshake.getParms();
            String peerId = parms.get("id");
            String key = parms.get("key");
            return new PeerWs(handshake, peerId, key);
        }

        /** Plain HTTP request → serve the PeerJS discovery endpoints (mirrors peer-server.ts). */
        @Override
        protected Response serveHttp(IHTTPSession session) {
            String uri = session.getUri();
            Log.d(TAG, "HTTP " + session.getMethod() + " " + uri);

            Response resp;
            if (uri.startsWith("/peerjs/id")) {
                // PeerJS client calls GET /peerjs/id?ts=..&version=.. to obtain an ID
                String id = "peer-" + System.currentTimeMillis() + "-" + randomHex(6);
                resp = newFixedLengthResponse(Response.Status.OK, "text/plain", id);
            } else if (uri.startsWith("/peerjs/port")) {
                resp = newFixedLengthResponse(Response.Status.OK, "application/json",
                        "{\"port\":" + actualPort + "}");
            } else if (uri.startsWith("/peerjs/key")) {
                resp = newFixedLengthResponse(Response.Status.OK, "text/plain", KEY);
            } else {
                resp = newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "Not Found");
            }

            // CORS — Android WebView origin is http://localhost, requesting host is a LAN IP
            resp.addHeader("Access-Control-Allow-Origin", "*");
            resp.addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            resp.addHeader("Access-Control-Allow-Headers", "Content-Type");
            return resp;
        }
    }

    // ─── PeerJS WebSocket connection ──────────────────────────────────────

    private class PeerWs extends NanoWSD.WebSocket {
        private final String peerId;
        private final String key;
        private boolean registered = false;

        PeerWs(IHTTPSession handshake, String peerId, String key) {
            super(handshake);
            this.peerId = peerId;
            this.key = key;
        }

        @Override
        protected void onOpen() {
            Log.d(TAG, "WS open: id=" + peerId + " key=" + (key != null ? "present" : "null"));
            if (peerId == null || key == null) {
                Log.w(TAG, "Missing params (id/key), rejecting");
                sendError("Missing id or key");
                return;
            }
            if (!KEY.equals(key)) {
                Log.w(TAG, "Invalid key from " + peerId + ", rejecting");
                sendError("Invalid key provided");
                return;
            }
            if (peers.containsKey(peerId)) {
                Log.w(TAG, "ID taken: " + peerId);
                try {
                    send("{\"type\":\"ID-TAKEN\",\"payload\":{\"msg\":\"ID is taken\"}}");
                    close(WebSocketFrame.CloseCode.GoingAway, "ID is taken", true);
                } catch (IOException ignored) {}
                return;
            }

            peers.put(peerId, this);
            registered = true;

            // Flush queued messages for this peer
            java.util.ArrayDeque<String> q = queues.remove(peerId);
            if (q != null) {
                String m;
                while ((m = q.poll()) != null) {
                    try { send(m); } catch (IOException ignored) {}
                }
            }

            try { send("{\"type\":\"OPEN\",\"id\":\"" + peerId + "\"}"); } catch (IOException ignored) {}
            Log.d(TAG, "Peer registered: " + peerId + " (total peers: " + peers.size() + ")");
        }

        @Override
        protected void onMessage(WebSocketFrame message) {
            if (message.getOpCode() != WebSocketFrame.OpCode.Text) return;
            handleMessage(message.getTextPayload(), peerId);
        }

        @Override
        protected void onClose(WebSocketFrame.CloseCode code, String reason, boolean initiatedByRemote) {
            if (!registered) return;
            peers.remove(peerId);
            queues.remove(peerId);
            Log.d(TAG, "Peer closed: " + peerId + " code=" + code + " remaining=" + peers.size());

            // Notify all peers about the disconnection
            for (Map.Entry<String, PeerWs> entry : peers.entrySet()) {
                try {
                    entry.getValue().send(
                            "{\"type\":\"LEAVE\",\"src\":\"" + peerId + "\",\"dst\":\"" + entry.getKey() + "\"}");
                } catch (IOException ignored) {}
            }
        }

        @Override
        protected void onPong(WebSocketFrame pong) {
            // No-op
        }

        @Override
        protected void onException(IOException exception) {
            Log.e(TAG, "WS exception: " + (exception != null ? exception.getMessage() : "null"));
        }

        private void sendError(String msg) {
            try {
                send("{\"type\":\"ERROR\",\"payload\":{\"msg\":\"" + msg + "\"}}");
                close(WebSocketFrame.CloseCode.PolicyViolation, msg, true);
            } catch (IOException ignored) {}
        }
    }

    // ─── Message routing (PeerJS signaling) ──────────────────────────────

    private void handleMessage(String message, String srcId) {
        try {
            JSONObject msg = new JSONObject(message);
            String type = msg.optString("type", "");
            String src = msg.optString("src", "");
            String dst = msg.optString("dst", "");

            Log.d(TAG, "Msg: type=" + type + " src=" + src + " dst=" + dst);

            switch (type) {
                case "LEAVE":
                    handleLeave(src, dst);
                    break;
                case "HEARTBEAT":
                case "heartbeat":
                    // No-op
                    break;
                case "JOIN":
                    // Client joining — notify ALL other peers (the host)
                    Log.d(TAG, "JOIN received from " + src);
                    for (Map.Entry<String, PeerWs> entry : peers.entrySet()) {
                        String otherId = entry.getKey();
                        if (!otherId.equals(src)) {
                            try {
                                entry.getValue().send(message);
                                Log.d(TAG, "Notified peer " + otherId + " about join from " + src);
                            } catch (IOException e) {
                                Log.e(TAG, "Failed to notify peer " + otherId + ": " + e.getMessage());
                            }
                        }
                    }
                    break;
                default:
                    // Forward offer/answer/candidate to destination peer
                    forwardMessage(dst, src, message);
                    break;
            }
        } catch (JSONException e) {
            Log.e(TAG, "Bad JSON: " + e.getMessage());
        }
    }

    private void forwardMessage(String dstId, String srcId, String message) {
        if (dstId == null || dstId.isEmpty()) {
            Log.w(TAG, "Forward message with empty dstId, ignoring");
            return;
        }
        PeerWs target = peers.get(dstId);
        if (target != null && target.isOpen()) {
            try {
                target.send(message);
                Log.d(TAG, "Forwarded msg to " + dstId);
            } catch (IOException e) {
                Log.e(TAG, "Send failed to " + dstId + ": " + e.getMessage());
                queueMessage(dstId, message);
            }
        } else {
            Log.d(TAG, "Peer " + dstId + " offline, queuing");
            queueMessage(dstId, message);
        }
    }

    private void handleLeave(String srcId, String dstId) {
        if (dstId == null || dstId.isEmpty()) {
            // src is leaving entirely — close their connection
            PeerWs target = peers.remove(srcId);
            queues.remove(srcId);
            if (target != null) {
                try { target.close(WebSocketFrame.CloseCode.NormalClosure, "leaving", true); } catch (IOException ignored) {}
            }
            Log.d(TAG, "Peer " + srcId + " disconnected");
            return;
        }
        // Notify dst that src left
        PeerWs dstPeer = peers.get(dstId);
        if (dstPeer != null && dstPeer.isOpen()) {
            try {
                dstPeer.send("{\"type\":\"LEAVE\",\"src\":\"" + srcId + "\",\"dst\":\"" + dstId + "\"}");
            } catch (IOException e) {
                Log.e(TAG, "Send LEAVE failed: " + e.getMessage());
            }
        }
        peers.remove(srcId);
        queues.remove(srcId);
        Log.d(TAG, "Peer " + srcId + " left session");
    }

    private void queueMessage(String dstId, String message) {
        queues.computeIfAbsent(dstId, k -> new java.util.ArrayDeque<>()).add(message);
    }

    private void startCleanup() {
        scheduler.scheduleAtFixedRate(() -> {
            if (!isRunning || server == null) return;
            cleanupStaleMessages();
        }, 5000, 5000, TimeUnit.MILLISECONDS);
    }

    private void cleanupStaleMessages() {
        for (java.util.ArrayDeque<String> q : queues.values()) {
            while (q.size() > 50) q.poll();
        }
    }

    private String randomHex(int len) {
        StringBuilder sb = new StringBuilder();
        String chars = "0123456789abcdef";
        for (int i = 0; i < len; i++) {
            sb.append(chars.charAt((int) (Math.random() * chars.length())));
        }
        return sb.toString();
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
                .setContentText("信令服务器运行中 (端口 " + actualPort + ")")
                .setSmallIcon(R.drawable.ic_notification)
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
            server.stop();
            server = null;
        }
        peers.clear();
        queues.clear();
        Log.d(TAG, "Service destroyed");
        super.onDestroy();
    }

    public String getServerIp() { return getLocalIpAddress(); }
    public int getServerPort() { return actualPort; }
}
