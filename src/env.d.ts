/// <reference types="vite/client" />

interface ElectronAPI {
  exit: () => void;
}

/** JavaScript interface injected by MainActivity.java into the Android WebView. */
interface AndroidBridge {
  getLocalIp: () => string;
  getServerPort: () => number;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    /** Native bridge, present only inside the Capacitor Android WebView. */
    AndroidBridge?: AndroidBridge;
    /** Injected by Android native code once the local WiFi IP is known. */
    __localIp?: string;
    /** Injected by Android native code once the signalling server is listening. */
    __serverPort?: number;
  }
}

export {};
