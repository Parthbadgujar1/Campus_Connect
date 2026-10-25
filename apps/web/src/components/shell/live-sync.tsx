'use client';

import { useEffect, useRef } from 'react';
import { invalidate } from '@/lib/api/hooks';
import { useLive } from '@/lib/realtime';
import { useSession } from '@/lib/session';
import { refreshBadges } from './app-shell';

// Keeps every screen current without a refresh. The API announces which area changed
// ("feed", "events"...); the matching lists and pages are fetched again in the background.
// Signals arriving while the app is in the background are remembered and applied when it is
// opened again, and after the connection drops everything shown is refreshed once.

const PREFIXES: Record<string, string[]> = {
  feed: ['feed:', 'post:', 'discover:trending', 'loops:'],
  events: ['events:', 'home:events'],
  spaces: ['spaces:', 'discussion:', 'discover:boards', 'home:discussions', 'study:'],
  hush: ['hush:', 'home:hush', 'contrib:hush'],
  market: ['market:', 'contrib:listings'],
  lostFound: ['lostfound:'],
  opportunities: ['opps:', 'teams:', 'home:opps'],
  shelf: ['shelf:', 'contrib:shelf', 'home:review'],
  news: ['news:', 'home:notices'],
  lectures: ['lectures:'],
  surveys: ['surveys:', 'admin:surveys:'],
  people: ['people:', 'profile:', 'home:people', 'connect:'],
  status: ['status:'],
  admin: ['admin:', 'home:admin-overview'],
};

export function LiveSync() {
  const { user } = useSession();
  const pending = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const connectedOnce = useRef(false);

  const apply = () => {
    timer.current = undefined;
    if (document.hidden) return; // applied when the app is visible again
    const prefixes = [...pending.current].flatMap((t) => PREFIXES[t] ?? []);
    pending.current.clear();
    if (prefixes.length) invalidate(...prefixes);
  };
  const queue = (topics: string[]) => {
    topics.forEach((t) => pending.current.add(t));
    // Hush (a live conversation) refreshes almost at once; other areas wait a moment so a burst of
    // changes becomes one refresh.
    if (topics.includes('hush') || topics.includes('status')) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(apply, 60);
    } else timer.current ??= setTimeout(apply, 400);
  };

  useLive(null, (e) => {
    if (!user) return;
    if (e.type === 'changed') {
      if (e.collegeId === user.college.id) queue(e.topics);
    } else if (e.type === 'notification.created') {
      invalidate('notifications:', 'badge:notifications');
      refreshBadges();
    } else if (e.type === 'ready') {
      // After a dropped connection, catch up on anything missed.
      if (connectedOnce.current) queue(Object.keys(PREFIXES));
      connectedOnce.current = true;
    }
  });

  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && pending.current.size) apply();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearTimeout(timer.current);
    };
  }, []);

  return null;
}
