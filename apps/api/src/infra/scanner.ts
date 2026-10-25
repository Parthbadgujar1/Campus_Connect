import { Socket } from 'node:net';
import { CircuitBreaker, CircuitOpenError } from '../core/circuit-breaker.js';

// Malware scanning for uploads. `clamav` streams the file to a clamd daemon (INSTREAM
// protocol). `none` is for development only and marks files as clean.
// If the scanner is configured but down, files stay `pending` (fail closed) and a background
// job retries them later; uploads are never silently published unscanned.

export type ScanResult = { status: 'clean' } | { status: 'infected'; signature: string } | { status: 'unavailable'; error: string };

export class Scanner {
  readonly breaker = new CircuitBreaker('scanner', { failureThreshold: 3, cooldownMs: 30_000 });

  constructor(private readonly options: { driver: 'none' | 'clamav'; host: string; port: number }) {}

  get enabled(): boolean {
    return this.options.driver !== 'none';
  }

  async scan(buffer: Buffer): Promise<ScanResult> {
    if (this.options.driver === 'none') return { status: 'clean' };
    try {
      const reply = await this.breaker.exec(() => this.instream(buffer));
      if (/OK\s*$/.test(reply)) return { status: 'clean' };
      const found = /stream: (.+) FOUND/.exec(reply);
      if (found) return { status: 'infected', signature: found[1]!.slice(0, 120) };
      return { status: 'unavailable', error: `unexpected scanner reply: ${reply.slice(0, 80)}` };
    } catch (err) {
      return { status: 'unavailable', error: err instanceof CircuitOpenError ? 'scanner circuit open' : (err as Error).message };
    }
  }

  private instream(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      const chunks: Buffer[] = [];
      socket.setTimeout(15_000, () => socket.destroy(new Error('scanner timeout')));
      socket.on('data', (d) => chunks.push(d));
      socket.on('error', reject);
      socket.on('close', () => resolve(Buffer.concat(chunks).toString('utf8').replace(/\0/g, '').trim()));
      socket.connect(this.options.port, this.options.host, () => {
        socket.write('zINSTREAM\0');
        const chunkSize = 64 * 1024;
        for (let offset = 0; offset < buffer.length; offset += chunkSize) {
          const chunk = buffer.subarray(offset, offset + chunkSize);
          const size = Buffer.alloc(4);
          size.writeUInt32BE(chunk.length, 0);
          socket.write(size);
          socket.write(chunk);
        }
        socket.write(Buffer.alloc(4)); // zero-length chunk ends the stream
      });
    });
  }

  async ping(): Promise<{ ok: boolean; error?: string }> {
    if (this.options.driver === 'none') return { ok: true };
    return new Promise((resolve) => {
      const socket = new Socket();
      socket.setTimeout(2_000, () => socket.destroy(new Error('timeout')));
      socket.on('error', (err) => resolve({ ok: false, error: err.message }));
      socket.on('data', (d) => {
        resolve({ ok: d.toString().includes('PONG') });
        socket.destroy();
      });
      socket.connect(this.options.port, this.options.host, () => socket.write('zPING\0'));
    });
  }
}
