// Starts a second local dev server (default port 3001) with its own build folder, so it can run
// next to `npm run dev` on port 3000 without the two fighting over .next/.
// Usage: npm run dev:alt --workspace=web      (PORT=3002 npm run dev:alt for another port)

import { spawn } from 'node:child_process';

const port = process.env.PORT || '3001';
if (!/^\d{2,5}$/.test(port)) throw new Error(`PORT must be a number, got "${port}"`);
// One command string (the port is validated above), so nothing is concatenated unescaped.
const child = spawn(`npx next dev -p ${port}`, {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NEXT_DIST_DIR: `.next-${port}` },
});
child.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
