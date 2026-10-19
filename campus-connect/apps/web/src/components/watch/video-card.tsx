'use client';

import Link from 'next/link';
import { Play } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { getChannel, watchProgress, type Video } from '@/data/videos';
import { relativeTime } from '@/lib/time';
import { compactNumber, gradientFor } from '@/lib/visuals';
import { cn } from '@/lib/utils';

export function duration(minutes: number) {
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`;
}

/**
 * A video as a soft "window": the thumbnail floats on a blurred copy of its own
 * colours, and a thin glow line shows how far you got.
 */
export function VideoThumb({ video, className, size = 'md' }: { video: Video; className?: string; size?: 'sm' | 'md' }) {
  const progress = watchProgress[video.id] ?? 0;
  return (
    <span className={cn('group/thumb relative block', className)}>
      <span
        aria-hidden="true"
        className="absolute inset-x-4 -bottom-2 top-4 rounded-2xl opacity-50 blur-xl transition-opacity duration-500 group-hover/thumb:opacity-80"
        style={{ background: gradientFor(video.seed) }}
      />
      <span
        className={cn('relative flex aspect-video items-center justify-center overflow-hidden text-white', size === 'sm' ? 'rounded-2xl' : 'rounded-2xl')}
        style={{ background: gradientFor(video.seed) }}
      >
        <span
          className={cn(
            'relative grid place-items-center rounded-full bg-white/25 transition-transform duration-500 ease-spring group-hover/thumb:scale-110',
            size === 'sm' ? 'h-9 w-9' : 'h-12 w-12',
          )}
        >
          <Play className={cn('translate-x-px fill-current', size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5')} aria-hidden="true" />
        </span>
        <span className="absolute bottom-2 right-2 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-semibold">{duration(video.durationMin)}</span>
        {video.kind === 'Lecture' && (
          <span className="absolute left-2 top-2 rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-semibold">Lecture</span>
        )}
        {progress > 0 && (
          <span className="absolute inset-x-3 bottom-0 h-1 overflow-hidden rounded-full bg-white/25" aria-label={`${progress}% watched`} role="img">
            <span className="block h-full rounded-full bg-white shadow-[0_0_10px_white]" style={{ width: `${progress}%` }} />
          </span>
        )}
      </span>
    </span>
  );
}

export function VideoCard({ video, layout = 'tile', className }: { video: Video; layout?: 'tile' | 'row'; className?: string }) {
  const channel = getChannel(video.channelId);
  if (layout === 'row') {
    return (
      <Link href={`/watch/v/${video.id}`} className={cn('press flex gap-3 rounded-2xl p-1.5 transition-colors hover:bg-surface-2', className)}>
        <VideoThumb video={video} size="sm" className="w-40 shrink-0" />
        <span className="min-w-0 py-1">
          <span className="line-clamp-2 text-sm font-semibold leading-snug">{video.title}</span>
          <span className="mt-1 block truncate text-xs text-text-3">{channel?.name}</span>
          <span className="block text-xs text-text-3">
            {compactNumber(video.views)} views · {relativeTime(video.uploadedAt)}
          </span>
        </span>
      </Link>
    );
  }
  return (
    <Link href={`/watch/v/${video.id}`} className={cn('press block', className)}>
      <VideoThumb video={video} />
      <span className="mt-3 flex gap-3 px-1">
        {channel && <Avatar name={channel.name} seed={channel.personId} size="sm" />}
        <span className="min-w-0">
          <span className="line-clamp-2 text-[15px] font-semibold leading-snug">{video.title}</span>
          <span className="mt-0.5 block truncate text-xs text-text-3">
            {channel?.name} · {compactNumber(video.views)} views · {relativeTime(video.uploadedAt)}
          </span>
        </span>
      </span>
    </Link>
  );
}
