import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import electron from 'electron';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
await import('./build-electron.mjs');
const server = await createServer({
  root,
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
});
await server.listen();
server.printUrls();
const child = spawn(electron, ['.'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, PANDORA_DEV_URL: 'http://127.0.0.1:5173' },
});
let closing = false;
async function close(code = 0) {
  if (closing) return;
  closing = true;
  child.kill();
  await server.close();
  process.exit(code);
}
child.on('error', error => { console.error(error.message); void close(1); });
child.on('exit', code => { void close(code ?? 0); });
process.on('SIGINT', () => { void close(0); });
process.on('SIGTERM', () => { void close(0); });
