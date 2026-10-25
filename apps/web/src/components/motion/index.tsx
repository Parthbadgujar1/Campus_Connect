'use client';

// Motion for the whole app, built on Framer Motion and kept calm:
//   MotionProvider  respects "Reduce motion" (Settings) and the device setting
//   Reveal          content rises softly into place when it first appears
//   Stagger/Item    lists that cascade in, a few items at a time
//   Pressable       cards that lift on hover and press down when tapped
//   Presence        items that animate out when removed (dismissed, deleted)
// Everything is transform and opacity only, so it stays smooth on low-end phones.

import { AnimatePresence, MotionConfig, motion, useReducedMotion, type HTMLMotionProps, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';
import { useAppState } from '@/lib/store';
import { cn } from '@/lib/utils';

export const EASE = [0.22, 1, 0.36, 1] as const;

export function MotionProvider({ children }: { children: ReactNode }) {
  const reduce = useAppState((s) => s.reduceMotion);
  return (
    <MotionConfig reducedMotion={reduce ? 'always' : 'user'} transition={{ duration: 0.35, ease: EASE }}>
      {children}
    </MotionConfig>
  );
}

export function Reveal({ children, delay = 0, y = 14, className, ...props }: { children: ReactNode; delay?: number; y?: number; className?: string } & Omit<HTMLMotionProps<'div'>, 'children'>) {
  return (
    <motion.div initial={{ opacity: 0, y }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE, delay }} className={className} {...props}>
      {children}
    </motion.div>
  );
}

const list: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } } };
const item: Variants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } };

export function Stagger({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'ul' | 'ol' | 'section' }) {
  const Tag = motion[as];
  return (
    <Tag variants={list} initial="hidden" animate="show" className={className}>
      {children}
    </Tag>
  );
}

export function StaggerItem({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'li' | 'article' }) {
  const Tag = motion[as];
  return (
    <Tag variants={item} className={className}>
      {children}
    </Tag>
  );
}

/** A card or tile that lifts slightly on hover and presses in when tapped. */
export function Pressable({ children, className, ...props }: { children: ReactNode; className?: string } & Omit<HTMLMotionProps<'div'>, 'children'>) {
  const reduce = useReducedMotion();
  return (
    <motion.div whileHover={reduce ? undefined : { y: -2 }} whileTap={reduce ? undefined : { scale: 0.98 }} transition={{ type: 'spring', stiffness: 420, damping: 30 }} className={className} {...props}>
      {children}
    </motion.div>
  );
}

/** Wraps a list whose children animate out when removed. Give each child a stable key. */
export function Presence({ children }: { children: ReactNode }) {
  return <AnimatePresence initial={false} mode="popLayout">{children}</AnimatePresence>;
}

/** A list row that fades and collapses when it leaves (use inside Presence). */
export function Leaving({ children, className, layoutId }: { children: ReactNode; className?: string; layoutId?: string }) {
  return (
    <motion.div layout layoutId={layoutId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }} className={cn(className)}>
      {children}
    </motion.div>
  );
}

export { AnimatePresence, motion };
