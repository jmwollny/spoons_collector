// Renders resources/*.png from render.html with headless Chrome, for
// @capacitor/assets to turn into Android's icon and splash files.
// Usage: node --experimental-websocket resources/render.mjs  (with
// Chrome at --remote-debugging-port=9333 and the dev server on 5199)
import fs from 'fs';
import path from 'path';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const out = path.dirname(new URL(import.meta.url).pathname);
const sizes = { 'icon-only': 1024, 'icon-foreground': 1024, 'icon-background': 1024, splash: 2732, 'splash-dark': 2732 };

const target = await (await fetch('http://localhost:9333/json/new?about:blank', { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener('open', resolve));
let id = 0;
const pending = new Map();
socket.addEventListener('message', (message) => {
  const data = JSON.parse(message.data);
  if (data.id && pending.has(data.id)) {
    pending.get(data.id)(data);
    pending.delete(data.id);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const callId = ++id;
    pending.set(callId, resolve);
    socket.send(JSON.stringify({ id: callId, method, params }));
  });

await send('Page.enable');
for (const [name, size] of Object.entries(sizes)) {
  await send('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  await send('Page.navigate', { url: `http://localhost:5199/resources/render.html?image=${name}` });
  await sleep(1500);
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: size, height: size, scale: 1 } });
  fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(shot.result.data, 'base64'));
  console.log(`${name}.png`);
}
await send('Target.closeTarget', { targetId: target.id });
socket.close();
process.exit(0);
