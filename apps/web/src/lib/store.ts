'use client';

// A small client-side store for per-device preferences: appearance (theme, font, text size,
// motion), which sections have been opened (the "new" dots) and personal study notes. It is
// saved to localStorage. Appearance and seen markers are also saved to the account, so they
// follow the person to other devices; notes stay on this device.

import { useSyncExternalStore } from 'react';
import type { Note } from './study';

/** pro = CampusConnect Pro (light), day = Doodle, night = Pro Night, paper = Paper. */
export type ThemePref = 'system' | 'pro' | 'day' | 'night' | 'paper';
export type TextSize = 'sm' | 'md' | 'lg';
/** pro = Space Grotesk (CampusConnect Pro), handwritten = Kalam (Doodle), system = General (device font), readable = Atkinson Hyperlegible. */
export type FontPref = 'pro' | 'handwritten' | 'system' | 'readable';

export interface AppState {
  theme: ThemePref;
  textSize: TextSize;
  font: FontPref;
  reduceMotion: boolean;
  /** Links the person has opened once; a dot marks the ones not opened yet. */
  seen: string[];
  notes: Note[];
}

export const STORAGE_KEY = 'cc:v1';

export const INITIAL_STATE: AppState = {
  theme: 'system',
  textSize: 'md',
  font: 'pro',
  reduceMotion: false,
  seen: [],
  notes: [],
};

let snapshot: AppState = INITIAL_STATE;
let hydrated = false;
const listeners = new Set<() => void>();

const THEMES: ThemePref[] = ['system', 'pro', 'day', 'night', 'paper'];
const SIZES: TextSize[] = ['sm', 'md', 'lg'];
const FONTS: FontPref[] = ['pro', 'handwritten', 'system', 'readable'];
// Early builds stored three sample notes on every device.
const SAMPLE_NOTES = new Set(['note-normal', 'note-deadlock', 'note-hackathon']);

/** Reads only the fields above, so keys left by older builds (sample data, a copy of the profile) are dropped. */
function readStorage(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_STATE;
    const s = JSON.parse(raw) as Record<string, unknown>;
    const theme = s.theme === 'dusk' ? 'night' : s.theme;
    return {
      theme: THEMES.includes(theme as ThemePref) ? (theme as ThemePref) : INITIAL_STATE.theme,
      textSize: SIZES.includes(s.textSize as TextSize) ? (s.textSize as TextSize) : INITIAL_STATE.textSize,
      font: FONTS.includes(s.font as FontPref) ? (s.font as FontPref) : INITIAL_STATE.font,
      reduceMotion: s.reduceMotion === true,
      seen: Array.isArray(s.seen) ? s.seen.filter((x): x is string => typeof x === 'string') : [],
      notes: Array.isArray(s.notes) ? (s.notes as Note[]).filter((n) => n && typeof n.id === 'string' && !SAMPLE_NOTES.has(n.id)) : [],
    };
  } catch {
    return INITIAL_STATE;
  }
}

function getSnapshot(): AppState {
  if (!hydrated && typeof window !== 'undefined') {
    snapshot = readStorage();
    hydrated = true;
    // Rewrite once so old keys are removed from the device too.
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Storage blocked: nothing to clean.
    }
  }
  return snapshot;
}

function setState(update: (state: AppState) => AppState) {
  snapshot = update(getSnapshot());
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage can be blocked (private mode); the in-memory state still works.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// The session layer registers this to sync newly opened sections to the server (all devices).
let onSeen: ((href: string) => void) | null = null;
export function setSeenListener(fn: ((href: string) => void) | null) {
  onSeen = fn;
}

export const appActions = {
  setTheme: (theme: ThemePref) => setState((s) => ({ ...s, theme })),
  setTextSize: (textSize: TextSize) => setState((s) => ({ ...s, textSize })),
  setFont: (font: FontPref) => setState((s) => ({ ...s, font })),
  setReduceMotion: (reduceMotion: boolean) => setState((s) => ({ ...s, reduceMotion })),
  /** Applies appearance and seen markers loaded from the server. */
  hydrateSettings: (patch: Partial<Pick<AppState, 'theme' | 'textSize' | 'font' | 'reduceMotion'>> & { seen?: string[] }) =>
    setState((s) => ({ ...s, ...patch, seen: patch.seen ? Array.from(new Set([...s.seen, ...patch.seen])) : s.seen })),
  markSeen: (href: string) =>
    setState((s) => {
      if (s.seen.includes(href)) return s;
      onSeen?.(href);
      return { ...s, seen: [...s.seen, href] };
    }),
  saveNote: (note: Note) =>
    setState((s) => {
      const exists = s.notes.some((n) => n.id === note.id);
      return { ...s, notes: exists ? s.notes.map((n) => (n.id === note.id ? note : n)) : [note, ...s.notes] };
    }),
  deleteNote: (id: string) => setState((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) })),
};

/** Subscribe a component to a slice of the store. Keep selectors returning stable values. */
export function useAppState<T>(selector: (state: AppState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getSnapshot()),
    () => selector(INITIAL_STATE),
  );
}
