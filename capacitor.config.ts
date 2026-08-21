import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.heartjs.game',
  appName: '红心大战',
  webDir: 'dist',
  // Use HTTP scheme to avoid mixed content when connecting to LAN server (HTTP)
  server: {
    androidScheme: 'http',
  },
};

export default config;
