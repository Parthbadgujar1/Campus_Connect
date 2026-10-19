import { hashString } from '@/lib/visuals';

const MODULES = 25;

/** Deterministic dark-module positions for a seed, excluding the three finder squares. */
function qrCells(seed: string): [number, number][] {
  const inFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= MODULES - 7 && y < 7) || (x < 7 && y >= MODULES - 7);
  let state = hashString(seed) || 1;
  const cells: [number, number][] = [];
  for (let y = 0; y < MODULES; y++) {
    for (let x = 0; x < MODULES; x++) {
      if (inFinder(x, y)) continue;
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      if (state % 2 === 0) cells.push([x, y]);
    }
  }
  return cells;
}

const finder = (x: number, y: number) => (
  <g key={`f-${x}-${y}`}>
    <rect x={x} y={y} width="7" height="7" fill="#0f1424" />
    <rect x={x + 1} y={y + 1} width="5" height="5" fill="#ffffff" />
    <rect x={x + 2} y={y + 2} width="3" height="3" fill="#0f1424" />
  </g>
);

/**
 * Visual stand-in for a QR code. It is deterministic per seed and has the three
 * finder squares, so it reads as a QR in the prototype. Real check-in tokens come
 * from the backend in the next phase.
 */
export function QrCode({ seed, size = 180, label }: { seed: string; size?: number; label: string }) {
  const cells = qrCells(seed);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`-1 -1 ${MODULES + 2} ${MODULES + 2}`}
      width={size}
      height={size}
      className="rounded-xl bg-white p-2"
    >
      <rect x="-1" y="-1" width={MODULES + 2} height={MODULES + 2} fill="#ffffff" />
      {finder(0, 0)}
      {finder(MODULES - 7, 0)}
      {finder(0, MODULES - 7)}
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#0f1424" />
      ))}
    </svg>
  );
}
