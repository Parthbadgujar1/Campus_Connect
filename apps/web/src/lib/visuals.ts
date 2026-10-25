// Deterministic colours for avatars, covers and media placeholders. The app has no
// real images yet, so every visual is derived from a stable seed string.

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

// A small family of calm hues (periwinkle, lavender, sky, teal, mint, rose, peach), so every
// generated colour in the app feels like it belongs to the same soothing palette.
const CALM_HUES = [228, 246, 266, 288, 206, 190, 168, 338, 14];

export function hueFor(seed: string): number {
  return CALM_HUES[hash(seed) % CALM_HUES.length];
}

// Highlight tones for headings. Each one is a feeling the colour carries:
// yellow for energy and optimism, green for growth and learning, blue for trust and calm,
// violet for curiosity and imagination, pink for warmth and people.
export type HighlightTone = 'violet' | 'blue' | 'yellow' | 'pink' | 'green';
const HIGHLIGHT_TONES: HighlightTone[] = ['violet', 'blue', 'yellow', 'pink', 'green'];

// A stable tone for any heading that does not choose one, so pages still get varied colour.
export function toneFor(seed: string): HighlightTone {
  return HIGHLIGHT_TONES[hash(seed) % HIGHLIGHT_TONES.length];
}

// A flat, muted colour per seed (no gradients), dark enough for white initials and icons.
// The name is historical: it is used as a CSS `background` value everywhere.
export function gradientFor(seed: string): string {
  return `hsl(${hueFor(seed)} 30% 46%)`;
}

export function initials(name: string): string {
  return name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
