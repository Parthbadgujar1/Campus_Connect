import { fileTypeFromBuffer } from 'file-type';

// What may be uploaded, and how it is identified.
//
// The type is decided from the file's actual bytes (magic numbers), never from the name or the
// Content-Type the client sends, so a renamed .exe or an HTML page posing as a .jpg is refused.
// Formats that can run script in a browser (HTML, SVG, XML) are never accepted, and text files
// are always served as text/plain downloads.

export type FileKind = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';
export type Purpose = 'avatar' | 'post' | 'message' | 'resource' | 'listing' | 'lost_found' | 'verification' | 'lecture' | 'event' | 'other';

const MB = 1024 * 1024;

const BY_MIME: Record<string, FileKind> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/quicktime': 'video',
  'video/x-m4v': 'video',
  'audio/mpeg': 'audio',
  'audio/mp4': 'audio',
  'audio/x-m4a': 'audio',
  'audio/aac': 'audio',
  'audio/aacp': 'audio',
  'audio/ogg': 'audio',
  'audio/opus': 'audio',
  'audio/wav': 'audio',
  'audio/x-wav': 'audio',
  'audio/webm': 'audio',
  'application/pdf': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'document',
  'application/vnd.oasis.opendocument.text': 'document',
  'application/vnd.oasis.opendocument.spreadsheet': 'document',
  'application/vnd.oasis.opendocument.presentation': 'document',
  'application/msword': 'document',
  'application/vnd.ms-excel': 'document',
  'application/vnd.ms-powerpoint': 'document',
  'text/plain': 'document',
  'text/csv': 'document',
  'application/zip': 'archive',
  'application/x-7z-compressed': 'archive',
  'application/x-rar-compressed': 'archive',
  'application/vnd.rar': 'archive',
  'application/gzip': 'archive',
};

// Legacy Office files share one container format (CFB); the extension tells them apart.
const CFB_BY_EXT: Record<string, string> = {
  doc: 'application/msword',
  xls: 'application/vnd.ms-excel',
  ppt: 'application/vnd.ms-powerpoint',
};

// Plain-text formats have no magic number. They are accepted only with one of these extensions
// and only if the content is valid UTF-8 without binary bytes.
const TEXT_EXT: Record<string, string> = {
  txt: 'text/plain', md: 'text/plain', csv: 'text/csv', json: 'text/plain', log: 'text/plain',
  py: 'text/plain', js: 'text/plain', ts: 'text/plain', java: 'text/plain', c: 'text/plain', cpp: 'text/plain',
  h: 'text/plain', cs: 'text/plain', go: 'text/plain', rs: 'text/plain', kt: 'text/plain', sql: 'text/plain',
  ipynb: 'text/plain', tex: 'text/plain',
};

interface Rule {
  kinds: FileKind[];
  maxBytes: (globalMax: number) => number;
  visibility: 'public' | 'campus' | 'private';
}

export const PURPOSES: Record<Purpose, Rule> = {
  avatar: { kinds: ['image'], maxBytes: () => 5 * MB, visibility: 'campus' },
  post: { kinds: ['image', 'video', 'audio', 'document'], maxBytes: (g) => g, visibility: 'campus' },
  message: { kinds: ['image', 'video', 'audio', 'document', 'archive'], maxBytes: (g) => g, visibility: 'private' },
  resource: { kinds: ['document', 'archive', 'image'], maxBytes: (g) => g, visibility: 'campus' },
  listing: { kinds: ['image'], maxBytes: () => 10 * MB, visibility: 'campus' },
  lost_found: { kinds: ['image'], maxBytes: () => 10 * MB, visibility: 'campus' },
  verification: { kinds: ['image', 'document'], maxBytes: () => 10 * MB, visibility: 'private' },
  lecture: { kinds: ['video', 'document'], maxBytes: (g) => g, visibility: 'campus' },
  event: { kinds: ['image'], maxBytes: () => 10 * MB, visibility: 'campus' },
  other: { kinds: ['image', 'document'], maxBytes: (g) => Math.min(g, 25 * MB), visibility: 'private' },
};

export interface Detected {
  mime: string;
  kind: FileKind;
  ext: string;
}

function extensionOf(name: string): string {
  const m = /\.([A-Za-z0-9]{1,10})$/.exec(name);
  return m ? m[1]!.toLowerCase() : '';
}

function looksLikeText(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, 64 * 1024);
  if (sample.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(sample.length < buffer.length ? sample.subarray(0, sample.lastIndexOf(0x0a) + 1 || sample.length) : sample);
    return true;
  } catch {
    return false;
  }
}

/** Identifies a file from its bytes. Returns null for anything not on the allow-list. */
export async function detect(buffer: Buffer, originalName: string): Promise<Detected | null> {
  const ext = extensionOf(originalName);
  const found = await fileTypeFromBuffer(buffer);
  if (found) {
    if (found.mime === 'application/x-cfb') {
      const mime = CFB_BY_EXT[ext];
      return mime ? { mime, kind: 'document', ext } : null;
    }
    // Audio-only WebM/MP4 voice notes are reported as video containers; trust the client's
    // extension only to pick between the two, never to widen what is accepted.
    if (found.mime === 'video/webm' && ext === 'weba') return { mime: 'audio/webm', kind: 'audio', ext };
    if (found.mime === 'video/mp4' && ext === 'm4a') return { mime: 'audio/mp4', kind: 'audio', ext };
    const kind = BY_MIME[found.mime];
    return kind ? { mime: found.mime, kind, ext: found.ext } : null;
  }
  const textMime = TEXT_EXT[ext];
  if (textMime && looksLikeText(buffer)) return { mime: textMime, kind: 'document', ext };
  return null;
}

/** Media that browsers can display inline safely; everything else is served as a download. */
export function isInlineSafe(mime: string): boolean {
  return /^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm|quicktime|x-m4v)|audio\/.+|application\/pdf)$/.test(mime);
}

/** A filename safe for storage keys and Content-Disposition headers. */
export function safeName(name: string): string {
  const cleaned = name
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f"\\/:*?<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(-180);
  return cleaned || 'file';
}
