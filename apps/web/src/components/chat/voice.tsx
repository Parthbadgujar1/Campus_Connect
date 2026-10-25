'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Send, Trash2 } from 'lucide-react';
import { ensureDuration } from '@/components/loops/media';
import { cn } from '@/lib/utils';

function mmss(s: number) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

/** The file name tells the API which audio type it is (browser recordings look like video). */
function fileNameFor(mime: string) {
  if (mime.includes('mp4') || mime.includes('aac')) return 'voice-note.m4a';
  if (mime.includes('ogg')) return 'voice-note.ogg';
  return 'voice-note.weba';
}

const MAX_SECONDS = 300;

/** Records a voice message right away: shows a timer, with cancel and send (like WhatsApp). */
export function VoiceRecorder({ onSend, onCancel, onError }: { onSend: (file: File) => void; onCancel: () => void; onError: (message: string) => void }) {
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const cancelled = useRef(false);
  const stream = useRef<MediaStream | null>(null);

  useEffect(() => {
    let tick: ReturnType<typeof setInterval> | undefined;
    (async () => {
      try {
        stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
        const rec = new MediaRecorder(stream.current, mime ? { mimeType: mime } : undefined);
        recorder.current = rec;
        rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
        rec.onstop = () => {
          stream.current?.getTracks().forEach((t) => t.stop());
          if (cancelled.current || !chunks.current.length) return;
          const type = rec.mimeType || 'audio/webm';
          onSend(new File(chunks.current, fileNameFor(type), { type: type.split(';')[0] }));
        };
        rec.start(250);
        const started = Date.now();
        tick = setInterval(() => {
          const s = (Date.now() - started) / 1000;
          setSeconds(s);
          if (s >= MAX_SECONDS) rec.stop();
        }, 200);
      } catch {
        onError('Allow the microphone to record a voice message.');
        onCancel();
      }
    })();
    return () => {
      clearInterval(tick);
      if (recorder.current?.state === 'recording') {
        cancelled.current = true;
        recorder.current.stop();
      }
      stream.current?.getTracks().forEach((t) => t.stop());
    };
    // Starts once when the recorder appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = (send: boolean) => {
    cancelled.current = !send;
    if (recorder.current?.state === 'recording') recorder.current.stop();
    if (!send) onCancel();
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2" role="status" aria-live="polite">
      <button type="button" onClick={() => stop(false)} aria-label="Cancel recording" className="grid h-10 w-10 place-items-center rounded-full text-danger hover:bg-danger-soft">
        <Trash2 className="h-5 w-5" aria-hidden="true" />
      </button>
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" aria-hidden="true" />
      <span className="font-sans flex-1 text-[15px] tabular-nums">Recording… {mmss(seconds)}</span>
      <button type="button" onClick={() => stop(true)} disabled={seconds < 0.6} aria-label="Send voice message" className="grid h-11 w-11 place-items-center rounded-full bg-accent text-accent-ink disabled:opacity-50">
        <Send className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}

/** A voice message in a chat bubble: play/pause, a progress bar you can drag, and the length. */
export function VoicePlayer({ src, mine }: { src: string; mine: boolean }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(0);
  const [rate, setRate] = useState(1);

  const toggle = async () => {
    const a = audio.current;
    if (!a) return;
    if (!length) setLength(await ensureDuration(a));
    if (a.paused) void a.play();
    else a.pause();
  };

  return (
    <div className="flex min-w-[210px] items-center gap-2.5 py-0.5">
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setLength(e.currentTarget.duration)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setTime(0);
        }}
      />
      <button type="button" onClick={() => void toggle()} aria-label={playing ? 'Pause voice message' : 'Play voice message'} className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full', mine ? 'bg-black/15' : 'bg-accent text-accent-ink')}>
        {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="ml-0.5 h-4 w-4" aria-hidden="true" />}
      </button>
      <input
        type="range"
        min={0}
        max={Math.max(0.1, length)}
        step={0.05}
        value={Math.min(time, length || 0)}
        onChange={(e) => {
          const a = audio.current;
          if (a && Number.isFinite(a.duration)) a.currentTime = Number(e.target.value);
        }}
        aria-label="Voice message position"
        className="h-1 min-w-0 flex-1 cursor-pointer accent-current"
      />
      <span className="font-sans w-9 shrink-0 text-right text-[11px] tabular-nums opacity-80">{mmss(playing || time ? time : length)}</span>
      <button
        type="button"
        onClick={() => {
          const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
          setRate(next);
          if (audio.current) audio.current.playbackRate = next;
        }}
        aria-label={`Playback speed ${rate}×`}
        className={cn('font-sans shrink-0 rounded-full px-1.5 text-[11px] font-bold', mine ? 'bg-black/15' : 'bg-surface')}
      >
        {rate}×
      </button>
    </div>
  );
}
