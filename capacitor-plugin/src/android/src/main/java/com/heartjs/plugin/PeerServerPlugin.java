package com.heartjs.plugin;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Collections;

@CapacitorPlugin(name = "PeerServer")
public class PeerServerPlugin extends Plugin {

    @PluginMethod
    public void getServerStatus(PluginCall call) {
        String ip = getLocalIpAddress();
        // Read the actual port written by PeerServerService (9000 or 9001)
        SharedPreferences prefs = getActivity().getSharedPreferences("heartjs_prefs", Context.MODE_PRIVATE);
        int port = prefs.getInt("server_port", 9000);
        org.json.JSONObject result = new org.json.JSONObject();
        try {
            result.put("ip", ip);
            result.put("port", port);
            result.put("url", "ws://" + ip + ":" + port + "/peerjs");
        } catch (Exception e) {
            call.error("Failed to build result: " + e.getMessage());
            return;
        }
        call.resolve(result);
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
        } catch (Exception e) {
            e.printStackTrace();
        }
        return "127.0.0.1";
    }
}
