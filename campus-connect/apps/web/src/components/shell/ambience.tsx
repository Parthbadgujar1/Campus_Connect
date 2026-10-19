'use client';

import { useState } from 'react';
import { BookOpen, Moon, MoonStar, Sun, SunMoon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Segmented } from '@/components/ui/chip';
import { Switch } from '@/components/ui/fields';
import { appActions, useAppState, type TextSize, type ThemePref } from '@/lib/store';
import { cn } from '@/lib/utils';

interface ThemeOption {
  value: ThemePref;
  label: string;
  hint: string;
  icon: LucideIcon;
  /** Preview swatch colours: background, surface, accent. */
  swatch: [string, string, string];
}

export const THEME_OPTIONS: ThemeOption[] = [
  { value: 'system', label: 'Auto', hint: 'Follows your device', icon: SunMoon, swatch: ['linear-gradient(135deg,#ffffff 50%,#13112a 50%)', '#ffffff', '#2563eb'] },
  { value: 'day', label: 'Day', hint: 'Light and clear', icon: Sun, swatch: ['#ffffff', '#f8fafc', '#2563eb'] },
  { value: 'night', label: 'Night', hint: 'Deep and restful', icon: Moon, swatch: ['#13112a', '#1c1939', '#b8f28b'] },
  { value: 'paper', label: 'Paper', hint: 'Reading mode, warm and still', icon: BookOpen, swatch: ['#f4eee2', '#fcf9f2', '#8a5a3b'] },
  { value: 'dusk', label: 'Dusk', hint: 'Low blue light for late nights', icon: MoonStar, swatch: ['#171329', '#211b3a', '#f2c27b'] },
];

/** The controls themselves; used in the sheet, on You and in Settings. */
export function AmbiencePanel({ compact = false }: { compact?: boolean }) {
  const theme = useAppState((s) => s.theme);
  const textSize = useAppState((s) => s.textSize);
  const reduceMotion = useAppState((s) => s.reduceMotion);

  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-label="Ambience" className={cn('grid gap-2.5', compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3')}>
        {THEME_OPTIONS.map((option) => {
          const selected = option.value === theme;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => appActions.setTheme(option.value)}
              className={cn(
                'press group relative overflow-hidden rounded-2xl border p-3 text-left transition-colors',
                selected ? 'border-accent bg-accent-soft' : 'border-border bg-surface hover:bg-surface-2',
              )}
            >
              <span
                className="mb-3 flex h-14 items-end gap-1.5 rounded-2xl p-2"
                style={{ background: option.swatch[0] }}
                aria-hidden="true"
              >
                <span className="h-6 flex-1 rounded-lg" style={{ background: option.swatch[1] }} />
                <span className="h-4 w-4 rounded-full" style={{ background: option.swatch[2] }} />
              </span>
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <Icon className="h-4 w-4" aria-hidden="true" />
                {option.label}
              </span>
              {!compact && <span className="mt-0.5 block text-xs text-text-3">{option.hint}</span>}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Text size</p>
        <Segmented<TextSize>
          label="Text size"
          value={textSize}
          onChange={appActions.setTextSize}
          options={[
            { value: 'sm', label: 'Smaller' },
            { value: 'md', label: 'Default' },
            { value: 'lg', label: 'Larger' },
          ]}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <Switch
          label="Calm motion"
          description="Turn off animations"
          checked={reduceMotion}
          onChange={appActions.setReduceMotion}
        />
      </div>
    </div>
  );
}

/** Round button that shows the current ambience and opens the picker. */
export function AmbienceButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const theme = useAppState((s) => s.theme);
  const option = THEME_OPTIONS.find((o) => o.value === theme) ?? THEME_OPTIONS[0]!;
  const Icon = option.icon;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Ambience: ${option.label}. Change theme, reading mode and text size`}
        title="Ambience"
        className={cn(
          'press grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-surface text-text-2 shadow-card transition-colors hover:text-text',
          className,
        )}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Ambience" description="Choose how CampusConnect feels right now">
        <AmbiencePanel />
      </Sheet>
    </>
  );
}
