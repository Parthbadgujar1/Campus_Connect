// Circuit breaker for outbound dependencies (database, Redis, SMTP, storage, scanner).
//
// closed    -> calls flow; consecutive failures are counted
// open      -> calls fail immediately for `cooldownMs` (no piling up on a dead service)
// half-open -> one trial call; success closes the circuit, failure opens it again
//
// This is what keeps one broken dependency from exhausting threads, sockets and memory and
// taking the whole API down with it.

export type BreakerState = 'closed' | 'open' | 'half-open';

export class CircuitOpenError extends Error {
  constructor(readonly service: string) {
    super(`${service} is unavailable (circuit open)`);
    this.name = 'CircuitOpenError';
  }
}

export interface BreakerSnapshot {
  name: string;
  state: BreakerState;
  failures: number;
  lastError?: string;
  openedAt?: string;
}

export class CircuitBreaker {
  private state: BreakerState = 'closed';
  private failures = 0;
  private openedAt = 0;
  private trialInFlight = false;
  private lastError?: string;

  constructor(
    readonly name: string,
    private readonly options: { failureThreshold?: number; cooldownMs?: number } = {},
  ) {}

  private get threshold() {
    return this.options.failureThreshold ?? 5;
  }

  private get cooldown() {
    return this.options.cooldownMs ?? 10_000;
  }

  /** True when a call would be attempted right now. */
  canAttempt(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'open' && Date.now() - this.openedAt >= this.cooldown) {
      this.state = 'half-open';
    }
    return this.state === 'half-open' && !this.trialInFlight;
  }

  async exec<T>(fn: () => Promise<T>, isFailure: (err: unknown) => boolean = () => true): Promise<T> {
    if (!this.canAttempt()) throw new CircuitOpenError(this.name);
    const trial = this.state === 'half-open';
    if (trial) this.trialInFlight = true;
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      if (isFailure(err)) this.onFailure(err);
      else if (trial) this.onSuccess();
      throw err;
    } finally {
      if (trial) this.trialInFlight = false;
    }
  }

  onSuccess(): void {
    this.state = 'closed';
    this.failures = 0;
  }

  onFailure(err: unknown): void {
    this.failures += 1;
    this.lastError = err instanceof Error ? err.message : String(err);
    if (this.state === 'half-open' || this.failures >= this.threshold) {
      this.state = 'open';
      this.openedAt = Date.now();
    }
  }

  snapshot(): BreakerSnapshot {
    // Refresh the state so an expired cooldown is reported as half-open.
    this.canAttempt();
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      lastError: this.lastError,
      openedAt: this.openedAt ? new Date(this.openedAt).toISOString() : undefined,
    };
  }
}
