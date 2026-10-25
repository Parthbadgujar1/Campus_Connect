import qrcode from 'qrcode-generator';
import { useMemo } from 'react';

/**
 * A real, scannable QR code for `value` (check-in codes, profile links). Drawn as an SVG with
 * one path, so it stays sharp at any size and prints well. Medium error correction survives
 * screen glare and a cracked phone screen.
 */
export function QrCode({ value, size = 180, label }: { value: string; size?: number; label: string }) {
  const { count, path } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
    return { count: n, path: d };
  }, [value]);
  return (
    <svg role="img" aria-label={label} viewBox={`-2 -2 ${count + 4} ${count + 4}`} width={size} height={size} shapeRendering="crispEdges" className="rounded-xl bg-white">
      <rect x={-2} y={-2} width={count + 4} height={count + 4} fill="#ffffff" />
      <path d={path} fill="#0f1424" />
    </svg>
  );
}
