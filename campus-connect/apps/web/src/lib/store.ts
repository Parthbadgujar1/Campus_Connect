'use client';

// A small client-side store for per-viewer state: ambience, saved items, RSVPs,
// joined spaces, votes, notes and the demo role. It persists to localStorage
// (a convenience only; a backend replaces it later).

import { useSyncExternalStore } from 'react';
import type { ApplicationStage, Role } from './types';
import { seedNotes, type Note } from '@/data/study';

export type ThemePref = 'system' | 'day' | 'night' | 'paper' | 'dusk';
export type TextSize = 'sm' | 'md' | 'lg';
export type Rsvp = 'going' | 'interested';
export type Vote = 1 | -1;

export interface Session {
  role: Role;
  name: string;
  email: string;
}

export interface AppState {
  /** Signed-in person. Null means the sign-in screen is shown. */
  session: Session | null;
  role: Role;
  theme: ThemePref;
  textSize: TextSize;
  reduceMotion: boolean;
  saved: string[];
  rsvp: Record<string, Rsvp>;
  liked: string[];
  joined: string[];
  following: string[];
  subscriptions: string[];
  votes: Record<string, Vote>;
  applications: Record<string, ApplicationStage>;
  readNotifications: string[];
  blocked: string[];
  muted: string[];
  openedSnaps: string[];
  seenMoments: string[];
  chatThemes: Record<string, string>;
  notes: Note[];
  dating: { optIn: boolean; incognito: boolean; campusOnly: boolean; verified18: boolean };
}

export const STORAGE_KEY = 'cc:v1';

export const INITIAL_STATE: AppState = {
  session: null,
  role: 'student',
  theme: 'system',
  textSize: 'md',
  reduceMotion: false,
  saved: [],
  rsvp: {},
  liked: [],
  joined: ['gdsc', 'dsa-club'],
  following: [],
  subscriptions: ['ch-anita'],
  votes: {},
  applications: {},
  readNotifications: [],
  blocked: [],
  muted: [],
  openedSnaps: [],
  seenMoments: [],
  chatThemes: {},
  notes: seedNotes,
  dating: { optIn: false, incognito: false, campusOnly: true, verified18: false },
};

let snapshot: AppState = INITIAL_STATE;
let hydrated = false;
const listeners = new Set<() => void>();

function readStorage(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_STATE;
    return { ...INITIAL_STATE, ...(JSON.parse(raw) as Partial<AppState>) };
  } catch {
    return INITIAL_STATE;
  }
}

function getSnapshot(): AppState {
  if (!hydrated && typeof window !== 'undefined') {
    snapshot = readStorage();
    hydrated = true;
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

function toggleIn(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

export const appActions = {
  setRole: (role: Role) => setState((s) => ({ ...s, role })),
  signIn: (session: Session) => setState((s) => ({ ...s, session, role: session.role })),
  signOut: () => setState((s) => ({ ...s, session: null })),
  setTheme: (theme: ThemePref) => setState((s) => ({ ...s, theme })),
  setTextSize: (textSize: TextSize) => setState((s) => ({ ...s, textSize })),
  setReduceMotion: (reduceMotion: boolean) => setState((s) => ({ ...s, reduceMotion })),
  toggleSaved: (id: string) => setState((s) => ({ ...s, saved: toggleIn(s.saved, id) })),
  toggleLiked: (id: string) => setState((s) => ({ ...s, liked: toggleIn(s.liked, id) })),
  toggleJoined: (id: string) => setState((s) => ({ ...s, joined: toggleIn(s.joined, id) })),
  toggleFollowing: (id: string) => setState((s) => ({ ...s, following: toggleIn(s.following, id) })),
  toggleSubscribed: (id: string) =>
    setState((s) => ({ ...s, subscriptions: toggleIn(s.subscriptions, id) })),
  toggleBlocked: (id: string) => setState((s) => ({ ...s, blocked: toggleIn(s.blocked, id) })),
  toggleMuted: (id: string) => setState((s) => ({ ...s, muted: toggleIn(s.muted, id) })),
  vote: (id: string, value: Vote) =>
    setState((s) => {
      const votes = { ...s.votes };
      if (votes[id] === value) delete votes[id];
      else votes[id] = value;
      return { ...s, votes };
    }),
  setRsvp: (eventId: string, value: Rsvp | null) =>
    setState((s) => {
      const rsvp = { ...s.rsvp };
      if (value) rsvp[eventId] = value;
      else delete rsvp[eventId];
      return { ...s, rsvp };
    }),
  applyFor: (id: string) =>
    setState((s) => ({ ...s, applications: { ...s.applications, [id]: 'Applied' } })),
  setApplicationStage: (id: string, stage: ApplicationStage) =>
    setState((s) => ({ ...s, applications: { ...s.applications, [id]: stage } })),
  withdrawApplication: (id: string) =>
    setState((s) => {
      const applications = { ...s.applications };
      delete applications[id];
      return { ...s, applications };
    }),
  markRead: (ids: string[]) =>
    setState((s) => ({
      ...s,
      readNotifications: Array.from(new Set([...s.readNotifications, ...ids])),
    })),
  openSnap: (id: string) =>
    setState((s) => (s.openedSnaps.includes(id) ? s : { ...s, openedSnaps: [...s.openedSnaps, id] })),
  seeMoment: (id: string) =>
    setState((s) => (s.seenMoments.includes(id) ? s : { ...s, seenMoments: [...s.seenMoments, id] })),
  setChatTheme: (chatId: string, theme: string) =>
    setState((s) => ({ ...s, chatThemes: { ...s.chatThemes, [chatId]: theme } })),
  saveNote: (note: Note) =>
    setState((s) => {
      const exists = s.notes.some((n) => n.id === note.id);
      return { ...s, notes: exists ? s.notes.map((n) => (n.id === note.id ? note : n)) : [note, ...s.notes] };
    }),
  deleteNote: (id: string) => setState((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) })),
  setDating: (patch: Partial<AppState['dating']>) =>
    setState((s) => ({ ...s, dating: { ...s.dating, ...patch } })),
};

/** Subscribe a component to a slice of the store. Keep selectors returning stable values. */
export function useAppState<T>(selector: (state: AppState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getSnapshot()),
    () => selector(INITIAL_STATE),
  );
}
