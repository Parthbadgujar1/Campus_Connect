'use client';

import { useEffect, useRef, useState } from 'react';
import { Clapperboard, ImageIcon, Pause, Play, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { errorMessage, post, uploadWithProgress } from '@/lib/api/client';
import { invalidate } from '@/lib/api/hooks';
import type { FileView, PostView } from '@/lib/api/types';
import { usePublicConfig } from '@/components/shell/public-shell';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Field, Select, Textarea } from '@/components/ui/fields';
import { FormAlert, Spinner } from '@/components/ui/states';
import { hashtagsIn } from '@/components/common/rich-text';
import { ensureDuration, formatBytes } from './media';

// Discover → Loops → New loop. Choose a video from the phone (or record one: phones offer the
// camera in the picker), pick the frame people see before it plays, write a caption (#hashtags
// and @mentions work) and post. The video uploads with a progress bar and can be cancelled.

const MAX_SECONDS = 180;
const CAPTION_MAX = 2200;

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

/** The current frame of a video as a JPEG (at most 1080 px tall). */
async function grabFrame(video: HTMLVideoElement): Promise<Blob> {
  const scale = Math.min(1, 1080 / (video.videoHeight || 1080));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round((video.videoWidth || 720) * scale));
  canvas.height = Math.max(1, Math.round((video.videoHeight || 1280) * scale));
  canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make a cover image.'))), 'image/jpeg', 0.86));
}

export function NewLoop({ onClose, onPosted }: { onClose: () => void; onPosted: (p: PostView) => void }) {
  const config = usePublicConfig();
  const maxMb = config.data?.uploads.purposes.post?.maxMb ?? config.data?.uploads.maxMb ?? 25;
  const input = useRef<HTMLInputElement | null>(null);
  const preview = useRef<HTMLVideoElement | null>(null);
  const abort = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [coverAt, setCoverAt] = useState(0.5);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState<'college' | 'department' | 'year'>('college');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (src) URL.revokeObjectURL(src);
  }, [src]);
  useEffect(() => () => abort.current?.abort(), []);

  const choose = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!f.type.startsWith('video/')) return setError('Choose a video file (MP4, MOV or WebM).');
    if (f.size > maxMb * 1024 * 1024) return setError(`This video is ${(f.size / 1024 / 1024).toFixed(0)} MB. Loops can be up to ${maxMb} MB; try a shorter clip.`);
    if (src) URL.revokeObjectURL(src);
    setFile(f);
    setSrc(URL.createObjectURL(f));
    setPlaying(false);
  };

  const onMeta = async () => {
    const v = preview.current;
    if (!v) return;
    const d = await ensureDuration(v);
    if (!d) {
      setError('This video could not be read. Try exporting it as MP4.');
      return;
    }
    if (d > MAX_SECONDS) {
      setError(`This video is ${formatTime(d)} long. Loops can be up to 3 minutes.`);
      setFile(null);
      setSrc(null);
      return;
    }
    setDuration(d);
    const at = Math.min(0.5, d / 2);
    setCoverAt(at);
    v.currentTime = at;
  };

  const togglePlay = () => {
    const v = preview.current;
    if (!v) return;
    if (v.paused) void v.play().then(() => setPlaying(true)).catch(() => undefined);
    else {
      v.pause();
      setPlaying(false);
    }
  };

  const publish = async () => {
    const v = preview.current;
    if (!file || !v) return;
    setError(null);
    const controller = new AbortController();
    abort.current = controller;
    try {
      // The cover is the frame chosen with the slider.
      v.pause();
      setPlaying(false);
      if (Math.abs(v.currentTime - coverAt) > 0.05) {
        v.currentTime = coverAt;
        await new Promise((r) => v.addEventListener('seeked', r, { once: true }));
      }
      const coverBlob = await grabFrame(v);
      setProgress(0);
      const video = await uploadWithProgress<FileView>('post', file, file.name || 'loop.mp4', (f) => setProgress(f * 0.92), controller.signal);
      const cover = await uploadWithProgress<FileView>('post', coverBlob, 'cover.jpg', (f) => setProgress(0.92 + f * 0.06), controller.signal);
      setProgress(0.99);
      const created = await post<PostView>('/posts', { body: caption.trim(), attachments: [video.id], coverId: cover.id, tags: hashtagsIn(caption), audience });
      invalidate('feed:');
      onPosted(created);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(errorMessage(err));
      setProgress(null);
    } finally {
      abort.current = null;
    }
  };

  const busy = progress !== null;
  return (
    <Sheet
      open
      onClose={() => {
        abort.current?.abort();
        onClose();
      }}
      title="New loop"
      description={file ? undefined : `A video up to 3 minutes and ${maxMb} MB.`}
      footer={
        file ? (
          <div className="w-full space-y-2">
            {busy && (
              <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((progress ?? 0) * 100)} aria-label="Upload progress">
                <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
              </div>
            )}
            <Button full onClick={() => void publish()} disabled={busy || !duration}>
              {busy ? <><Spinner /> Posting… {Math.round((progress ?? 0) * 100)}%</> : 'Share loop'}
            </Button>
          </div>
        ) : undefined
      }
    >
      <input ref={input} type="file" accept="video/mp4,video/quicktime,video/webm,video/x-m4v,video/*" hidden onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ''; }} />
      {error && <FormAlert className="mb-3">{error}</FormAlert>}
      {!file ? (
        <button type="button" onClick={() => input.current?.click()} className="flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-border px-6 py-12 text-center hover:bg-surface-2">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-accent-soft-ink"><Clapperboard className="h-8 w-8" aria-hidden="true" /></span>
          <span className="text-[17px] font-semibold">Choose or record a video</span>
          <span className="max-w-xs text-[14px] text-text-3">Vertical videos look best. On a phone you can record one right away.</span>
        </button>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-4 max-sm:flex-col">
            <div className="relative mx-auto aspect-[9/16] w-48 shrink-0 overflow-hidden rounded-2xl bg-black">
              {src && <video ref={preview} src={src} muted={muted} playsInline loop preload="auto" onLoadedMetadata={() => void onMeta()} onPause={() => setPlaying(false)} className="h-full w-full object-contain" />}
              <button type="button" onClick={togglePlay} aria-label={playing ? 'Pause preview' : 'Play preview'} className="absolute inset-0 grid place-items-center">
                {!playing && <span className="grid h-12 w-12 place-items-center rounded-full bg-black/50 text-white"><Play className="h-6 w-6" aria-hidden="true" /></span>}
                {playing && <span className="sr-only"><Pause /></span>}
              </button>
              <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Sound on' : 'Mute'} className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white">
                {muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              <Field label={`Cover (${formatTime(coverAt)})`} htmlFor="loop-cover" hint="Slide to choose the frame people see first.">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 shrink-0 text-text-3" aria-hidden="true" />
                  <input
                    id="loop-cover"
                    type="range"
                    min={0}
                    max={Math.max(0.1, duration - 0.05)}
                    step={0.05}
                    value={coverAt}
                    disabled={busy || !duration}
                    onChange={(e) => {
                      const t = Number(e.target.value);
                      setCoverAt(t);
                      const v = preview.current;
                      if (v) {
                        v.pause();
                        v.currentTime = t;
                      }
                    }}
                    className="w-full accent-[var(--accent)]"
                  />
                </div>
              </Field>
              <p className="text-[13px] text-text-3">{file.name} · {formatBytes(file.size)} · {formatTime(duration)}</p>
              <Button variant="secondary" size="sm" onClick={() => input.current?.click()} disabled={busy}><RefreshCw className="h-4 w-4" aria-hidden="true" /> Choose another</Button>
            </div>
          </div>
          <Field label="Caption" htmlFor="loop-caption" hint={`${caption.length}/${CAPTION_MAX} · #hashtags and @mentions work`}>
            <Textarea id="loop-caption" rows={3} value={caption} maxLength={CAPTION_MAX} disabled={busy} onChange={(e) => setCaption(e.target.value)} placeholder="Write a caption… #hackathon @friend" />
          </Field>
          <Field label="Who can see it" htmlFor="loop-audience">
            <Select id="loop-audience" value={audience} disabled={busy} onChange={(e) => setAudience(e.target.value as typeof audience)}>
              <option value="college">Everyone at your college</option>
              <option value="department">Your department</option>
              <option value="year">Your year</option>
            </Select>
          </Field>
        </div>
      )}
    </Sheet>
  );
}
