'use client';

// The signed-in person, for the whole web app.
//
// On load it asks the API who is signed in (the httpOnly session cookie proves it), then loads
// their appearance settings so theme, font and text size follow them across devices. It keeps
// the older demo store in step (role, name), so screens that still read it keep working.
// Any 401 from the API (session ended, signed out elsewhere) returns the app to sign-in.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, get, patch, post, type ApiError } from './api/client';
import type { ApiRole, Me, SessionPayload, Settings } from './api/types';
import { appActions, setSeenListener } from './store';
import type { Role } from './types';

export type SessionStatus = 'loading' | 'signed-in' | 'signed-out' | 'unavailable';

export type SettingsPatch = Partial<Pick<Settings, 'theme' | 'font' | 'textSize' | 'reduceMotion' | 'highContrast'>> & {
  onboarding?: 'completed' | 'skipped' | 'reset';
  tour?: 'completed' | 'skipped' | 'reset';
};

interface SessionValue {
  status: SessionStatus;
  user: Me | null;
  settings: Settings | null;
  /** Reloads the person and settings (after editing the profile, verifying, etc.). */
  refresh: () => Promise<void>;
  signIn: (email: string, password: string, rememberMe: boolean) => Promise<Me>;
  /** Called after verify-email, which signs the person in on the server. */
  adopt: (payload: SessionPayload) => Promise<void>;
  signOut: (everywhere?: boolean) => Promise<void>;
  updateSettings: (patch: SettingsPatch) => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

/** Moderators use the admin tools in the UI; the API still checks the real role on every call. */
export function uiRole(role: ApiRole): Role {
  if (role === 'moderator' || role === 'admin') return 'admin';
  return role;
}

function applyAppearance(settings: Settings) {
  appActions.hydrateSettings({ theme: settings.theme, textSize: settings.textSize, font: settings.font, reduceMotion: settings.reduceMotion, seen: settings.seen });
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<Me | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const pendingSeen = useRef<string[]>([]);
  const seenTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const enter = useCallback(async (me: Me) => {
    setUser(me);
    appActions.signIn({ role: uiRole(me.role), name: me.profile.displayName, email: me.email });
    try {
      const s = await get<Settings>('/me/settings');
      setSettings(s);
      applyAppearance(s);
    } catch {
      // Settings are a nicety; the app works with the local ones.
    }
    setStatus('signed-in');
  }, []);

  const leave = useCallback(() => {
    setUser(null);
    setSettings(null);
    appActions.signOut();
    setStatus('signed-out');
  }, []);

  const refresh = useCallback(async () => {
    try {
      const payload = await api<SessionPayload>('/auth/session', { quiet401: true });
      if (payload.user) await enter(payload.user);
      else leave();
    } catch (err) {
      const e = err as ApiError;
      if (e.status === 401) leave();
      else setStatus((s) => (s === 'signed-in' ? s : 'unavailable'));
    }
  }, [enter, leave]);

  useEffect(() => {
    void refresh();
    const onUnauthorized = () => leave();
    window.addEventListener('cc:unauthorized', onUnauthorized);
    return () => window.removeEventListener('cc:unauthorized', onUnauthorized);
  }, [refresh, leave]);

  // Opened sections ("new" dots) are batched and synced to the server.
  useEffect(() => {
    if (status !== 'signed-in') {
      setSeenListener(null);
      return;
    }
    setSeenListener((href) => {
      const key = href.toLowerCase().slice(0, 80);
      if (!/^[a-z0-9/_:.-]{1,80}$/.test(key)) return;
      pendingSeen.current.push(key);
      clearTimeout(seenTimer.current);
      seenTimer.current = setTimeout(() => {
        const batch = pendingSeen.current.splice(0, 50);
        if (batch.length) void patch('/me/settings', { seenAdd: batch }).catch(() => undefined);
      }, 1500);
    });
    return () => setSeenListener(null);
  }, [status]);

  const signIn = useCallback(
    async (email: string, password: string, rememberMe: boolean) => {
      const payload = await post<SessionPayload>('/auth/login', { email, password, rememberMe });
      if (!payload.user) throw new Error('Sign-in did not complete. Please try again.');
      await enter(payload.user);
      return payload.user;
    },
    [enter],
  );

  const adopt = useCallback(async (payload: SessionPayload) => {
    if (payload.user) await enter(payload.user);
  }, [enter]);

  const signOut = useCallback(
    async (everywhere = false) => {
      try {
        await post(everywhere ? '/auth/logout-all' : '/auth/logout');
      } finally {
        leave();
      }
    },
    [leave],
  );

  const updateSettings = useCallback(async (change: SettingsPatch) => {
    // Apply on this device immediately; the server copy follows.
    if (change.theme) appActions.setTheme(change.theme);
    if (change.textSize) appActions.setTextSize(change.textSize);
    if (change.font) appActions.setFont(change.font);
    if (change.reduceMotion !== undefined) appActions.setReduceMotion(change.reduceMotion);
    const next = await patch<Settings>('/me/settings', change);
    setSettings(next);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ status, user, settings, refresh, signIn, adopt, signOut, updateSettings }),
    [status, user, settings, refresh, signIn, adopt, signOut, updateSettings],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** For components that may render outside the provider (returns null there). */
export function useOptionalSession(): SessionValue | null {
  return useContext(SessionContext);
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}
