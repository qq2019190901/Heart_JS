const { PeerServer } = require('peer');

const server = PeerServer({ port: 9000, path: '/peerjs' });

console.log('PeerJS server running on port 9000');
console.log('Clients connect to ws://localhost:9000/peerjs');
