'use client';

import { LiveHome } from '@/components/home/live-home';

/**
 * Home for everyone, from live data. Staff (faculty, moderators, admins) also get a "Your tools"
 * row with their queues; students see the feed, events, deadlines, notices and discussions.
 */
export default function HomePage() {
  return <LiveHome />;
}
