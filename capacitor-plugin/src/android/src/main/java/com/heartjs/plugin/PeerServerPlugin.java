package com.heartjs.plugin;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Collections;

@CapacitorPlugin(name = "PeerServer")
public class PeerServerPlugin extends Plugin {

    @PluginMethod
    public void getServerStatus(PluginCall call) {
        String ip = getLocalIpAddress();
        call.resolve(new org.json.JSONObject() {{
            put("ip", ip);
            put("port", 9000);
            put("url", "ws://" + ip + ":9000/peerjs");
        }});
    }

    private String getLocalIpAddress() {
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
}
