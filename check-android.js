const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:9222/devtools/page/72BFC66195F89C03757C0738CE1801E7');
ws.on('open', () => {
  console.log('Connected to WebView\n');

  // Check 1: navigator.userAgent
  ws.send(JSON.stringify({id: 1, method: 'Runtime.evaluate', params: {expression: 'navigator.userAgent'}}));

  // Check 2: __localIp
  ws.send(JSON.stringify({id: 2, method: 'Runtime.evaluate', params: {expression: 'typeof window.__localIp + " | " + (window.__localIp || "undefined")'}}));

  // Check 3: __serverPort
  ws.send(JSON.stringify({id: 3, method: 'Runtime.evaluate', params: {expression: 'typeof window.__serverPort + " | " + (window.__serverPort !== undefined ? window.__serverPort : "undefined")'}}));

  // Check 4: AndroidBridge
  ws.send(JSON.stringify({id: 4, method: 'Runtime.evaluate', params: {expression: 'typeof window.AndroidBridge + " | " + (window.AndroidBridge ? window.AndroidBridge.getLocalIp() : "N/A")'}}));

  // Check 5: LanPeerManager state
  ws.send(JSON.stringify({id: 5, method: 'Runtime.evaluate', params: {expression: '(typeof lanPeer !== "undefined" ? String(lanPeer.isAndroid) : "lanPeer undefined") + " | " + (typeof lanPeer !== "undefined" ? JSON.stringify(lanPeer.serverConfig) : "null")'}}));
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data);
    if (msg.id) {
      const value = msg.result?.result?.value;
      const type = msg.result?.result?.type;
      console.log(`ID ${msg.id} [${type}]: ${value !== undefined ? value : JSON.stringify(msg.result)}`);
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const args = msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
      console.log(`[Browser Log] ${args}`);
    }
  } catch(e) {}
});

ws.on('error', (e) => console.error('WS Error:', e.message));
setTimeout(() => { ws.close(); process.exit(0); }, 8000);
