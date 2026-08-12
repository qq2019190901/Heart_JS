export interface PeerServerOptions {
  /** Server IP address */
  ip: string;
  /** Server port */
  port: number;
  /** Full WebSocket URL */
  url: string;
}

export interface PeerServerPlugin {
  getServerStatus(): Promise<PeerServerOptions>;
}

declare global {
  interface Window {
    capacitorPlugins?: {
      PeerServer?: PeerServerPlugin;
    };
  }
}
