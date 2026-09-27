const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:9222/devtools/page/2875B50EFD5EA70F0149AC7191FCF5E1');
ws.on('open', () => {
  console.log('Connected to WebView');
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
setTimeout(() => { ws.close(); process.exit(0); }, 60000);
