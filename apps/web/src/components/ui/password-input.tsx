'use client';

import { useId, useState, type InputHTMLAttributes } from 'react';
import { Check, Eye, EyeOff, X } from 'lucide-react';
import { fieldClass } from './fields';
import { cn } from '@/lib/utils';

/** Password field with a show/hide button. The button is a real toggle for screen readers. */
export function PasswordInput({ className, invalid, ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        aria-invalid={invalid || undefined}
        className={cn(fieldClass, 'h-12 pr-12', invalid && 'border-danger', className)}
        autoCapitalize="none"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        title={visible ? 'Hide password' : 'Show password'}
        className="press absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-text-3 hover:bg-surface-2 hover:text-text"
      >
        {visible ? <EyeOff className="h-[18px] w-[18px]" aria-hidden="true" /> : <Eye className="h-[18px] w-[18px]" aria-hidden="true" />}
      </button>
    </div>
  );
}

// The same rules the server applies (apps/api/src/modules/auth/password.ts), shown as you type.
const COMMON = new Set(['password', 'password123', 'qwerty123', '1234567890', 'iloveyou', 'welcome123', 'admin123', 'student123', 'college123', 'campus123', 'campusconnect']);

export function passwordChecks(password: string, context: { email?: string; name?: string } = {}) {
  const lower = password.toLowerCase();
  const local = context.email?.split('@')[0]?.toLowerCase() ?? '';
  return [
    { ok: password.length >= 10, label: 'At least 10 characters' },
    { ok: password.length > 0 && !COMMON.has(lower) && !/^(.)\1+$/.test(password) && !/^\d+$/.test(password), label: 'Not a common or simple pattern' },
    { ok: !(local.length >= 4 && lower.includes(local)), label: 'Does not contain your email name' },
  ];
}

/** Live checklist under a new-password field. Long passphrases are encouraged over symbols. */
export function PasswordHints({ password, email, name }: { password: string; email?: string; name?: string }) {
  const id = useId();
  const checks = passwordChecks(password, { email, name });
  const score = checks.filter((c) => c.ok).length + (password.length >= 16 ? 1 : 0);
  const label = !password ? '' : score >= 4 ? 'Strong' : score === 3 ? 'Good' : 'Weak';
  return (
    <div className="font-sans space-y-2" aria-live="polite" id={id}>
      {password && (
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < score ? (score >= 4 ? 'bg-success' : score === 3 ? 'bg-accent' : 'bg-warning') : 'bg-surface-3')} />
            ))}
          </div>
          <span className="text-[12px] font-semibold text-text-2">{label}</span>
        </div>
      )}
      <ul className="space-y-1">
        {checks.map((c) => (
          <li key={c.label} className={cn('flex items-center gap-1.5 text-[13px]', c.ok ? 'text-success' : 'text-text-3')}>
            {c.ok ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <X className="h-3.5 w-3.5" aria-hidden="true" />}
            {c.label}
          </li>
        ))}
        <li className="text-[12px] text-text-3">Tip: a few unrelated words (like a sentence) are easy to remember and hard to guess.</li>
      </ul>
    </div>
  );
}
