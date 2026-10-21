// The one way the web app talks to the CampusConnect API.
//
//   * calls go to /api/v1/... on this site; Next forwards them to the API (see next.config.ts),
//     so the session cookie is first-party and there are no CORS preflights
//   * state-changing calls send the CSRF token from the readable cc_csrf cookie
//   * every failure becomes an ApiError with a code to branch on and a message that is safe and
//     friendly to show as-is ("You seem to be offline", "This event is full", ...)
//   * reads are retried once after a network blip or a brief 503
//   * a 401 on a signed-in page tells the session layer to show the sign-in screen

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly requestId: string | null;
  readonly retryAfterSeconds: number | null;

  constructor(status: number, code: string, message: string, details?: unknown, requestId?: string | null, retryAfter?: number | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId ?? null;
    this.retryAfterSeconds = retryAfter ?? null;
  }

  /** Field-level messages for forms, e.g. { email: 'Enter a valid email address.' }. */
  get fields(): Record<string, string> {
    const out: Record<string, string> = {};
    if (Array.isArray(this.details)) {
      for (const d of this.details as FieldError[]) if (d?.field && !out[d.field]) out[d.field] = d.message;
    }
    return out;
  }

  /** Reasons from WEAK_PASSWORD responses. */
  get reasons(): string[] {
    const r = (this.details as { reasons?: unknown } | undefined)?.reasons;
    return Array.isArray(r) ? r.map(String) : [];
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

/** A message that can be shown to anyone, for any error. */
export function errorMessage(e: unknown): string {
  if (isApiError(e)) return e.message;
  return 'Something went wrong. Please try again.';
}

const BASE = '/api/v1';
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function csrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const m = /(?:^|;\s*)(?:__Host-)?cc_csrf=([^;]+)/.exec(document.cookie);
  return m ? decodeURIComponent(m[1]!) : undefined;
}

export type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
  /** Do not announce a 401 (used by the session check itself). */
  quiet401?: boolean;
}

export function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}${path.includes('?') ? '&' : '?'}${qs}` : path;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.body !== undefined && !isForm) headers['content-type'] = 'application/json';
  if (UNSAFE.has(method)) {
    const token = csrfToken();
    if (token) headers['x-csrf-token'] = token;
  }
  const url = `${BASE}${withQuery(path, options.query)}`;
  const init: RequestInit = {
    method,
    headers,
    credentials: 'same-origin',
    signal: options.signal,
    body: options.body === undefined ? undefined : isForm ? (options.body as FormData) : JSON.stringify(options.body),
  };

  const attempts = method === 'GET' ? 2 : 1;
  for (let attempt = 1; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err;
      if (attempt < attempts) {
        await sleep(600);
        continue;
      }
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      throw new ApiError(0, offline ? 'OFFLINE' : 'NETWORK', offline ? 'You seem to be offline. Check your connection and try again.' : 'Could not reach CampusConnect. Please try again in a moment.');
    }

    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (res.ok) return data as T;

    const envelope = (data as { error?: { code?: string; message?: string; details?: unknown; requestId?: string } } | null)?.error;
    const retryAfter = Number(res.headers.get('retry-after')) || null;
    // Brief overload or a dependency blip: one quiet retry for reads.
    if (attempt < attempts && (res.status === 503 || res.status === 502) && (retryAfter ?? 1) <= 3) {
      await sleep(800);
      continue;
    }
    if (!envelope) {
      // No API envelope: the proxy could not reach the API at all.
      throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'CampusConnect is not responding right now. Please try again shortly.', undefined, null, retryAfter);
    }
    const error = new ApiError(res.status, envelope.code ?? 'UNKNOWN', envelope.message ?? 'Something went wrong. Please try again.', envelope.details, envelope.requestId, retryAfter);
    if (res.status === 401 && !options.quiet401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cc:unauthorized', { detail: error.code }));
    }
    throw error;
  }
}

export const get = <T>(path: string, query?: Query, signal?: AbortSignal) => api<T>(path, { query, signal });
export const post = <T>(path: string, body: unknown = {}) => api<T>(path, { method: 'POST', body });
export const put = <T>(path: string, body: unknown = {}) => api<T>(path, { method: 'PUT', body });
export const patch = <T>(path: string, body: unknown = {}) => api<T>(path, { method: 'PATCH', body });
export const del = <T>(path: string, body?: unknown) => api<T>(path, { method: 'DELETE', body });

/** Uploads one file; returns the stored file (id, url, thumbnailUrl...). */
export function upload<T>(purpose: string, file: File): Promise<T> {
  const form = new FormData();
  form.append('file', file, file.name);
  return api<T>(`/files?purpose=${encodeURIComponent(purpose)}`, { method: 'POST', body: form });
}

/** A stable random id for idempotent sends (chat messages). */
export function clientId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 24);
}
