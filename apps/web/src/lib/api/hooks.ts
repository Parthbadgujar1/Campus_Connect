'use client';

// Small data hooks on top of the API client (no extra dependency):
//   useQuery     one resource, cached per key, shown instantly from cache and refreshed in the
//                background (stale-while-revalidate), refreshed again when the tab regains focus
//   useInfinite  cursor-paged lists ("Load more" / infinite scroll)
//   useAction    a button's async action with pending + error state (no double submits)
//   invalidate   after a change, refresh every screen showing data under a key prefix

import { useCallback, useEffect, useRef, useState } from 'react';
import { type ApiError, errorMessage } from './client';

const cache = new Map<string, { data: unknown; at: number }>();
// Requests in flight, so components that mount together share one network call per key.
const inflightRequests = new Map<string, Promise<unknown>>();

/** Runs fetcher once per key at a time; later callers get the same promise. */
function shared<T>(key: string, version: number, fetcher: () => Promise<T>): Promise<T> {
  const id = `${key}#${version}`;
  const existing = inflightRequests.get(id) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = fetcher().finally(() => inflightRequests.delete(id));
  inflightRequests.set(id, promise);
  return promise;
}
const subscribers = new Map<string, Set<() => void>>();
const FOCUS_REFRESH_MS = 30_000;

function subscribe(key: string, fn: () => void): () => void {
  if (!subscribers.has(key)) subscribers.set(key, new Set());
  subscribers.get(key)!.add(fn);
  return () => {
    subscribers.get(key)?.delete(fn);
  };
}

/** Refreshes every mounted query whose key starts with one of the prefixes. */
export function invalidate(...prefixes: string[]): void {
  for (const key of [...cache.keys()]) if (prefixes.some((p) => key.startsWith(p))) cache.delete(key);
  for (const [key, fns] of subscribers) if (prefixes.some((p) => key.startsWith(p))) fns.forEach((fn) => fn());
}

function toError(err: unknown): ApiError | Error {
  return err instanceof Error ? err : new Error(errorMessage(err));
}

/** Re-runs when the key is invalidated, when the tab regains focus (if stale) and on a timer. */
function useRefreshTriggers(key: string | null, bump: () => void, isStale: () => boolean, refreshMs?: number) {
  useEffect(() => {
    if (!key) return;
    const unsubscribe = subscribe(key, bump);
    const onFocus = () => {
      if (isStale()) bump();
    };
    window.addEventListener('focus', onFocus);
    const timer = refreshMs ? setInterval(bump, refreshMs) : undefined;
    return () => {
      unsubscribe();
      window.removeEventListener('focus', onFocus);
      if (timer) clearInterval(timer);
    };
  }, [key, bump, isStale, refreshMs]);
}

export interface QueryState<T> {
  data: T | undefined;
  error: ApiError | Error | null;
  /** True only while there is nothing to show yet (first load): render a skeleton. */
  loading: boolean;
  /** True while refreshing data that is already on screen. */
  refreshing: boolean;
  reload: () => void;
  /** Updates what is shown (optimistic changes). Returning undefined leaves it as it is. */
  setData: (update: T | ((current: T | undefined) => T | undefined)) => void;
}

export function useQuery<T>(key: string | null, fetcher: (signal: AbortSignal) => Promise<T>, options: { refreshMs?: number } = {}): QueryState<T> {
  const [state, setState] = useState<{ key: string | null; data: T | undefined; error: ApiError | Error | null }>(() => ({
    key,
    data: key ? (cache.get(key)?.data as T | undefined) : undefined,
    error: null,
  }));
  const [inflight, setInflight] = useState(false);
  const [version, setVersion] = useState(0);
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  // A new key shows that key's cached data (or nothing), never the previous key's data.
  let current = state;
  if (state.key !== key) {
    current = { key, data: key ? (cache.get(key)?.data as T | undefined) : undefined, error: null };
    setState(current);
  }

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    setInflight(true);
    // Shared by every component asking for this key right now; finishing it even if this one
    // unmounts is fine (the result is cached for the next screen).
    shared(key, version, () => fetcherRef.current(new AbortController().signal))
      .then((value) => {
        cache.set(key, { data: value, at: Date.now() });
        if (!cancelled) setState({ key, data: value, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled || (err as Error).name === 'AbortError') return;
        setState((s) => (s.key === key ? { ...s, error: toError(err) } : s));
      })
      .finally(() => {
        if (!cancelled) setInflight(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key, version]);

  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const isStale = useCallback(() => {
    const entry = key ? cache.get(key) : undefined;
    return !entry || Date.now() - entry.at > FOCUS_REFRESH_MS;
  }, [key]);
  useRefreshTriggers(key, bump, isStale, options.refreshMs);

  const setData = useCallback(
    (update: T | ((current: T | undefined) => T | undefined)) => {
      setState((s) => {
        const next = typeof update === 'function' ? (update as (c: T | undefined) => T | undefined)(s.data) : update;
        if (next === undefined) return s;
        if (key) cache.set(key, { data: next, at: Date.now() });
        return { ...s, data: next };
      });
    },
    [key],
  );

  return {
    data: current.data,
    error: current.error,
    loading: current.data === undefined && !current.error && Boolean(key),
    refreshing: inflight && current.data !== undefined,
    reload: bump,
    setData,
  };
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface InfiniteState<T> {
  items: T[];
  error: ApiError | Error | null;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
  setItems: (update: (items: T[]) => T[]) => void;
}

interface InfiniteData<T> {
  key: string | null;
  items: T[];
  cursor: string | null;
  loaded: boolean;
  error: ApiError | Error | null;
}

export function useInfinite<T>(key: string | null, fetchPage: (cursor: string | null, signal: AbortSignal) => Promise<Page<T>>): InfiniteState<T> {
  const [state, setState] = useState<InfiniteData<T>>({ key, items: [], cursor: null, loaded: false, error: null });
  const [loadingMore, setLoadingMore] = useState(false);
  const [version, setVersion] = useState(0);
  const fetchRef = useRef(fetchPage);
  useEffect(() => {
    fetchRef.current = fetchPage;
  });

  let current = state;
  if (state.key !== key) {
    const cached = key ? (cache.get(key)?.data as Page<T> | undefined) : undefined;
    current = { key, items: cached?.items ?? [], cursor: cached?.nextCursor ?? null, loaded: Boolean(cached), error: null };
    setState(current);
  }

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    fetchRef
      .current(null, controller.signal)
      .then((page) => {
        cache.set(key, { data: page, at: Date.now() });
        setState({ key, items: page.items, cursor: page.nextCursor, loaded: true, error: null });
      })
      .catch((err: unknown) => {
        if ((err as Error).name === 'AbortError') return;
        setState((s) => (s.key === key ? { ...s, error: toError(err) } : s));
      });
    return () => controller.abort();
  }, [key, version]);

  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const isStale = useCallback(() => {
    const entry = key ? cache.get(key) : undefined;
    return !entry || Date.now() - entry.at > FOCUS_REFRESH_MS;
  }, [key]);
  useRefreshTriggers(key, bump, isStale);

  const loadMore = useCallback(() => {
    const cursor = current.cursor;
    if (!cursor || loadingMore || current.key !== key) return;
    setLoadingMore(true);
    const controller = new AbortController();
    fetchRef
      .current(cursor, controller.signal)
      .then((page) => setState((s) => (s.key === key ? { ...s, items: [...s.items, ...page.items], cursor: page.nextCursor, error: null } : s)))
      .catch((err: unknown) => setState((s) => (s.key === key ? { ...s, error: toError(err) } : s)))
      .finally(() => setLoadingMore(false));
  }, [current.cursor, current.key, key, loadingMore]);

  const setItems = useCallback((update: (items: T[]) => T[]) => {
    setState((s) => ({ ...s, items: update(s.items) }));
  }, []);

  return {
    items: current.items,
    error: current.error,
    loading: !current.loaded && !current.error && Boolean(key),
    loadingMore,
    hasMore: Boolean(current.cursor),
    loadMore,
    reload: bump,
    setItems,
  };
}

export interface ActionState<A extends unknown[], R> {
  run: (...args: A) => Promise<R | undefined>;
  pending: boolean;
  error: ApiError | Error | null;
  clearError: () => void;
}

/** Wraps an async action: no double submits, and the error is kept for the form to show. */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>): ActionState<A, R> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const busy = useRef(false);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const run = useCallback(async (...args: A) => {
    if (busy.current) return undefined;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      return await fnRef.current(...args);
    } catch (err) {
      setError(toError(err));
      return undefined;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }, []);
  const clearError = useCallback(() => setError(null), []);
  return { run, pending, error, clearError };
}
