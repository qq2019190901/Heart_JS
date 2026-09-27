const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:9222/devtools/page/72BFC66195F89C03757C0738CE1801E7');
ws.on('open', () => {
  console.log('Connected to WebView, waiting for logs...');
  ws.send(JSON.stringify({id: 1, method: 'Runtime.enable'}));
});
ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const args = msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
      console.log(`[${msg.params.type}] ${args}`);
    }
  } catch(e) {}
});
ws.on('error', (e) => console.error('WS Error:', e.message));
setTimeout(() => { ws.close(); process.exit(0); }, 30000);
