'use client';

import { useState } from 'react';
import { BookOpen, Moon, Sun, SunMoon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Segmented } from '@/components/ui/chip';
import { Switch } from '@/components/ui/fields';
import { useOptionalSession, type SettingsPatch } from '@/lib/session';
import { appActions, useAppState, type FontPref, type TextSize, type ThemePref } from '@/lib/store';
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
];

export interface FontOption {
  value: FontPref;
  label: string;
  hint: string;
  /** The family used for the preview, so each card shows its own font. */
  family: string;
}

export const FONT_OPTIONS: FontOption[] = [
  { value: 'handwritten', label: 'Kalam', hint: 'The CampusConnect look', family: 'var(--font-kalam), cursive' },
  { value: 'system', label: 'System default', hint: 'Your device’s own font', family: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  { value: 'readable', label: 'Easy to read', hint: 'For low vision and dyslexia', family: 'var(--font-atkinson), system-ui, sans-serif' },
];

/** Applies a change on this device and, when signed in, saves it to the account (all devices). */
function useAppearance() {
  const session = useOptionalSession();
  return (change: SettingsPatch) => {
    if (session?.status === 'signed-in') {
      void session.updateSettings(change).catch(() => undefined);
      return;
    }
    if (change.theme) appActions.setTheme(change.theme);
    if (change.textSize) appActions.setTextSize(change.textSize);
    if (change.font) appActions.setFont(change.font);
    if (change.reduceMotion !== undefined) appActions.setReduceMotion(change.reduceMotion);
  };
}

/** Font cards; each previews its own typeface. */
export function FontPicker() {
  const font = useAppState((s) => s.font);
  const apply = useAppearance();
  return (
    <div role="radiogroup" aria-label="Font" className="grid grid-cols-2 gap-2.5">
      {FONT_OPTIONS.map((option) => {
        const selected = option.value === font;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => apply({ font: option.value })}
            className={cn(
              'press rounded-2xl border p-3 text-left transition-colors',
              selected ? 'border-accent bg-accent-soft' : 'border-border bg-surface hover:bg-surface-2',
            )}
          >
            <span className="block text-[26px] leading-none" style={{ fontFamily: option.family }} aria-hidden="true">
              Aa
            </span>
            <span className="mt-1.5 block truncate text-[15px]" style={{ fontFamily: option.family }} aria-hidden="true">
              Campus life, today
            </span>
            <span className="font-sans mt-2 block text-sm font-semibold">{option.label}</span>
            <span className="font-sans block text-xs text-text-3">{option.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The controls themselves; used in the sheet, on You and in Settings. */
export function AmbiencePanel({ compact = false }: { compact?: boolean }) {
  const theme = useAppState((s) => s.theme);
  const textSize = useAppState((s) => s.textSize);
  const reduceMotion = useAppState((s) => s.reduceMotion);
  const apply = useAppearance();

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
              onClick={() => apply({ theme: option.value })}
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
        <p className="text-sm font-semibold">Font</p>
        <FontPicker />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Text size</p>
        <Segmented<TextSize>
          label="Text size"
          value={textSize}
          onChange={(textSize) => apply({ textSize })}
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
          onChange={(reduceMotion) => apply({ reduceMotion })}
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
        aria-label={`Appearance: ${option.label}. Change theme, font and text size`}
        title="Appearance"
        className={cn(
          'press grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-surface text-text-2 shadow-card transition-colors hover:text-text',
          className,
        )}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Appearance" description="Theme, font and text size. Saved to your account.">
        <AmbiencePanel />
      </Sheet>
    </>
  );
}
