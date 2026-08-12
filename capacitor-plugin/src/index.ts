import { registerPlugin } from '@capacitor/core';

import type { PeerServerPlugin } from './definitions';

const PeerServer = registerPlugin<PeerServerPlugin>('PeerServer', {
  web: () => ({
    getServerStatus: async () => ({ ip: '127.0.0.1', port: 9000, url: 'ws://127.0.0.1:9000/peerjs' }),
  }),
});

export * from './definitions';
export { PeerServer };
