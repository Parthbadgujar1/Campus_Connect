'use client';

// One live connection for the whole app (chats, typing, read receipts). It gets a short-lived
// ticket over the normal API, opens the WebSocket, re-subscribes to open chats after a drop,
// and reconnects with growing pauses (1 s, 2 s, 4 s… up to 30 s). Works the same on Wi-Fi and
// mobile data: when the network changes, the socket drops and comes back by itself. Anything
// missed while offline is fetched again through the REST API by the screens themselves.

import { useEffect, useRef } from 'react';
import { get } from './api/client';

export type LiveEvent =
  | { type: 'message.created'; chatId: string; message: unknown }
  | { type: 'message.deleted'; chatId: string; messageId: string }
  | { type: 'message.reactions'; chatId: string; messageId: string; reactions: Array<{ emoji: string; count: number }> }
  | { type: 'message.response'; chatId: string; messageId: string; responses: Record<string, number> }
  | { type: 'chat.read'; chatId: string; userId: string; at: string }
  | { type: 'chat.updated'; chatId: string }
  | { type: 'typing'; chatId: string; userId: string; name: string }
  | { type: 'changed'; collegeId: string; topics: string[] }
  | { type: 'notification.created'; notification: unknown }
  | { type: 'flags.changed' }
  | { type: 'presence'; userId: string; online: boolean; at: string }
  | { type: 'ready' }
  | { type: 'subscribed'; chatId: string }
  | { type: 'error'; code: string; chatId?: string };

type Listener = (event: LiveEvent) => void;

class LiveConnection {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private chats = new Map<string, number>();
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private connecting = false;
  private stopped = true;

  private async open() {
    if (this.connecting || this.socket?.readyState === WebSocket.OPEN) return;
    this.connecting = true;
    try {
      const { url } = await get<{ url: string }>('/realtime/ticket');
      const ws = new WebSocket(url);
      this.socket = ws;
      ws.onopen = () => {
        this.attempts = 0;
        for (const chatId of this.chats.keys()) ws.send(JSON.stringify({ type: 'subscribe', chatId }));
      };
      ws.onmessage = (e) => {
        let event: LiveEvent;
        try {
          event = JSON.parse(String(e.data)) as LiveEvent;
        } catch {
          return;
        }
        this.emit(event);
      };
      ws.onclose = () => {
        this.socket = null;
        this.retry();
      };
      ws.onerror = () => ws.close();
    } catch {
      this.retry();
    } finally {
      this.connecting = false;
    }
  }

  /** Tells every screen about an event; a screen whose handler fails does not stop the others from hearing it. */
  private emit(event: LiveEvent) {
    for (const fn of [...this.listeners]) {
      try {
        fn(event);
      } catch (err) {
        console.error('A live-update handler failed', err);
      }
    }
  }

  private retry() {
    if (this.stopped || !this.listeners.size) return;
    clearTimeout(this.timer);
    const delay = Math.min(30_000, 1000 * 2 ** this.attempts++);
    this.timer = setTimeout(() => void this.open(), delay);
  }

  listen(fn: Listener): () => void {
    this.listeners.add(fn);
    this.stopped = false;
    void this.open();
    return () => {
      this.listeners.delete(fn);
      if (!this.listeners.size) {
        this.stopped = true;
        clearTimeout(this.timer);
        this.socket?.close();
        this.socket = null;
      }
    };
  }

  subscribe(chatId: string): () => void {
    this.chats.set(chatId, (this.chats.get(chatId) ?? 0) + 1);
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: 'subscribe', chatId }));
    return () => {
      const n = (this.chats.get(chatId) ?? 1) - 1;
      if (n <= 0) {
        this.chats.delete(chatId);
        if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: 'unsubscribe', chatId }));
      } else this.chats.set(chatId, n);
    };
  }

  typing(chatId: string) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: 'typing', chatId }));
  }

  /** Reconnect now (after the device comes back online). */
  wake() {
    if (!this.stopped && !this.socket) {
      this.attempts = 0;
      void this.open();
    }
  }
}

const live = typeof window !== 'undefined' ? new LiveConnection() : null;
if (typeof window !== 'undefined') window.addEventListener('online', () => live?.wake());

/** Live events for one chat (or every chat when chatId is null). Calls back on reconnect too. */
export function useLive(chatId: string | null, onEvent: (event: LiveEvent) => void) {
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });
  useEffect(() => {
    if (!live) return;
    const stop = live.listen((e) => {
      if (e.type === 'ready' || !chatId || ('chatId' in e && e.chatId === chatId)) handler.current(e);
    });
    const unsub = chatId ? live.subscribe(chatId) : undefined;
    return () => {
      unsub?.();
      stop();
    };
  }, [chatId]);
}

export function sendTyping(chatId: string) {
  live?.typing(chatId);
}
