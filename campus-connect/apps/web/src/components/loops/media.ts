// Helpers for video files in Loops.

/**
 * The real length of a video. Files recorded in a browser (WebM from screen or camera
 * recorders) often say "Infinity" until played to the end; jumping far ahead makes the
 * browser work it out, then the video goes back to the start.
 */
export function ensureDuration(video: HTMLMediaElement, timeoutMs = 4000): Promise<number> {
  if (Number.isFinite(video.duration) && video.duration > 0) return Promise.resolve(video.duration);
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener('durationchange', check);
      video.removeEventListener('timeupdate', check);
      const d = Number.isFinite(video.duration) ? video.duration : 0;
      video.currentTime = 0;
      resolve(d);
    };
    const check = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) finish();
    };
    video.addEventListener('durationchange', check);
    video.addEventListener('timeupdate', check);
    try {
      video.currentTime = 1e9;
    } catch {
      finish();
    }
    setTimeout(finish, timeoutMs);
  });
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
