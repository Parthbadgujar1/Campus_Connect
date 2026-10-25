'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Send, Trash2, X } from 'lucide-react';
import { patch, post } from '@/lib/api/client';
import { invalidate, useAction } from '@/lib/api/hooks';
import type { ApiRole } from '@/lib/api/types';
import type { AdminSurveyDetail, SurveyQuestion, SurveyQuestionType, SurveyView } from '@/lib/api/modules';
import { Button } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/chip';
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/fields';
import { Card } from '@/components/ui/layout';
import { FormAlert, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { ROLE_LABEL } from '@/lib/roles';
import { toLocalInput } from '@/lib/live-time';

// Admin → Surveys → New / Edit. Questions can be single or multiple choice, short text, a 1–5
// star rating or a 0–10 scale. Compulsory surveys must be answered before the app can be used;
// anonymous ones never record who answered.

const TYPES: Array<{ value: SurveyQuestionType; label: string }> = [
  { value: 'single', label: 'One choice' },
  { value: 'multiple', label: 'Several choices' },
  { value: 'rating', label: 'Stars (1–5)' },
  { value: 'scale', label: 'Scale (0–10)' },
  { value: 'text', label: 'Written answer' },
];
const CATEGORIES: Array<{ value: SurveyView['category']; label: string }> = [
  { value: 'app', label: 'About the app' },
  { value: 'campus', label: 'Campus life' },
  { value: 'academics', label: 'Academics' },
  { value: 'events', label: 'Events' },
  { value: 'other', label: 'Other' },
];
const ROLES: ApiRole[] = ['student', 'faculty', 'expert', 'moderator', 'admin'];

type Draft = Omit<SurveyQuestion, 'id'> & { key: string; id?: string; optionsText: string };
const key = () => Math.random().toString(36).slice(2, 10);
const blank = (): Draft => ({ key: key(), type: 'single', prompt: '', options: [], optionsText: '', required: true });

function toDraft(q: SurveyQuestion): Draft {
  return { ...q, key: q.id, optionsText: q.options.join('\n') };
}

function problems(questions: Draft[]): string | null {
  for (const [i, q] of questions.entries()) {
    if (q.prompt.trim().length < 3) return `Question ${i + 1} needs a question (at least 3 characters).`;
    if (q.type === 'single' || q.type === 'multiple') {
      const opts = q.optionsText.split('\n').map((o) => o.trim()).filter(Boolean);
      if (opts.length < 2) return `Question ${i + 1} needs at least two options, one per line.`;
      if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) return `Question ${i + 1} has the same option twice.`;
      if (opts.length > 12) return `Question ${i + 1} can have up to 12 options.`;
    }
  }
  return null;
}

export function SurveyBuilder({ survey }: { survey?: AdminSurveyDetail }) {
  const router = useRouter();
  const toast = useToast();
  const locked = Boolean(survey && survey.responsesCount > 0);
  const [title, setTitle] = useState(survey?.title ?? '');
  const [description, setDescription] = useState(survey?.description ?? '');
  const [category, setCategory] = useState<SurveyView['category']>(survey?.category ?? 'app');
  const [compulsory, setCompulsory] = useState(survey?.compulsory ?? false);
  const [anonymous, setAnonymous] = useState(survey?.anonymous ?? true);
  const [roles, setRoles] = useState<ApiRole[]>(survey?.audienceRoles ?? []);
  const [closes, setCloses] = useState(survey?.closesAt ? toLocalInput(new Date(survey.closesAt)) : '');
  const [questions, setQuestions] = useState<Draft[]>(survey?.questions?.map(toDraft) ?? [blank()]);
  // Set once saved, so a second tap while the next page loads cannot create a duplicate.
  const [saved, setSaved] = useState(false);

  const update = (k: string, change: Partial<Draft>) => setQuestions((list) => list.map((q) => (q.key === k ? { ...q, ...change } : q)));
  const move = (i: number, by: number) =>
    setQuestions((list) => {
      const next = [...list];
      const [q] = next.splice(i, 1);
      next.splice(i + by, 0, q!);
      return next;
    });

  const save = useAction(async (publish: boolean) => {
    const issue = locked ? null : problems(questions);
    if (issue) throw new Error(issue);
    if (closes && new Date(closes) <= new Date()) throw new Error('Choose a closing time in the future, or leave it empty.');
    const body = {
      title: title.trim(),
      description: description.trim(),
      category,
      compulsory,
      anonymous,
      audienceRoles: roles,
      closesAt: closes ? new Date(closes).toISOString() : survey ? null : undefined,
      ...(locked
        ? {}
        : {
            questions: questions.map((q) => ({
              ...(q.id ? { id: q.id } : {}),
              type: q.type,
              prompt: q.prompt.trim(),
              options: q.type === 'single' || q.type === 'multiple' ? q.optionsText.split('\n').map((o) => o.trim()).filter(Boolean) : [],
              required: q.required,
            })),
          }),
    };
    let id = survey?.id;
    let notified = 0;
    if (survey) {
      const r = await patch<{ notified: number }>(`/admin/surveys/${survey.id}`, { ...body, ...(publish && survey.status !== 'published' ? { status: 'published' } : {}) });
      notified = r.notified;
    } else {
      const r = await post<{ id: string; notified: number }>('/admin/surveys', { ...body, publish });
      id = r.id;
      notified = r.notified;
    }
    setSaved(true);
    invalidate('admin:surveys', 'surveys:', 'admin:overview');
    toast(publish ? `Published. ${notified} ${notified === 1 ? 'person was' : 'people were'} notified.` : 'Saved as a draft');
    router.replace(`/admin/surveys/${id}`);
  });

  const published = survey?.status === 'published';
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Card className="space-y-4 p-4">
        <Field label="Title" htmlFor="sv-title"><Input id="sv-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="How is CampusConnect working for you?" /></Field>
        <Field label="Description (optional)" htmlFor="sv-desc"><Textarea id="sv-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} placeholder="Two minutes. Your answers shape the next update." /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Topic" htmlFor="sv-cat">
            <Select id="sv-cat" value={category} onChange={(e) => setCategory(e.target.value as SurveyView['category'])}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="Closes (optional)" htmlFor="sv-close" hint="Closed surveys stop taking answers.">
            <Input id="sv-close" type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} />
          </Field>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">Who should answer</p>
          <ChipRow>
            <Chip active={!roles.length} onClick={() => setRoles([])}>Everyone</Chip>
            {ROLES.map((r) => (
              <Chip key={r} active={roles.includes(r)} onClick={() => setRoles((list) => (list.includes(r) ? list.filter((x) => x !== r) : [...list, r]))}>{ROLE_LABEL[r]}</Chip>
            ))}
          </ChipRow>
        </div>
        <div className="-mx-4 divide-y divide-border border-y border-border">
          <Switch checked={compulsory} onChange={setCompulsory} label="Compulsory" description="People must answer before using the app. They cannot skip it." />
          <Switch checked={anonymous} onChange={setAnonymous} disabled={locked && Boolean(survey?.anonymous)} label="Anonymous" description={locked && survey?.anonymous ? 'People already answered anonymously, so this stays on.' : 'Answers are never linked to names, even in downloads.'} />
        </div>
      </Card>

      {locked && <FormAlert tone="info">{survey!.responsesCount} people have answered, so the questions are fixed. To change them, close this survey and start a new one.</FormAlert>}

      <div className="space-y-3">
        {questions.map((q, i) => (
          <Card key={q.key} className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <span className="font-sans text-[13px] font-semibold text-text-3">Question {i + 1}</span>
              <span className="flex-1" />
              {!locked && (
                <>
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up" className="grid h-8 w-8 place-items-center rounded-full hover:bg-surface-2 disabled:opacity-30"><ArrowUp className="h-4 w-4" aria-hidden="true" /></button>
                  <button type="button" disabled={i === questions.length - 1} onClick={() => move(i, 1)} aria-label="Move down" className="grid h-8 w-8 place-items-center rounded-full hover:bg-surface-2 disabled:opacity-30"><ArrowDown className="h-4 w-4" aria-hidden="true" /></button>
                  {questions.length > 1 && <button type="button" onClick={() => setQuestions((list) => list.filter((x) => x.key !== q.key))} aria-label={`Delete question ${i + 1}`} className="grid h-8 w-8 place-items-center rounded-full text-text-3 hover:bg-surface-2 hover:text-danger"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>}
                </>
              )}
            </div>
            <Input value={q.prompt} disabled={locked} onChange={(e) => update(q.key, { prompt: e.target.value })} maxLength={300} placeholder="Ask something" aria-label={`Question ${i + 1}`} />
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <Select value={q.type} disabled={locked} onChange={(e) => update(q.key, { type: e.target.value as SurveyQuestionType })} aria-label={`Question ${i + 1} type`}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
              <label className="font-sans flex items-center gap-2 text-[14px] font-semibold">
                <input type="checkbox" checked={q.required} disabled={locked} onChange={(e) => update(q.key, { required: e.target.checked })} className="h-5 w-5 accent-[var(--accent)]" /> Must answer
              </label>
            </div>
            {(q.type === 'single' || q.type === 'multiple') && (
              <Textarea value={q.optionsText} disabled={locked} onChange={(e) => update(q.key, { optionsText: e.target.value })} rows={4} placeholder={'One option per line\nVery good\nGood\nNeeds work'} aria-label={`Question ${i + 1} options`} />
            )}
          </Card>
        ))}
        {!locked && questions.length < 30 && (
          <Button variant="secondary" onClick={() => setQuestions((list) => [...list, blank()])}><Plus className="h-4 w-4" aria-hidden="true" /> Add a question</Button>
        )}
      </div>

      {save.error && <FormAlert>{save.error.message}</FormAlert>}
      <div className="sticky bottom-20 z-10 flex flex-wrap gap-2 rounded-2xl border border-border bg-[var(--surface-solid)] p-3 shadow-float md:bottom-4">
        {!published && (
          <Button onClick={() => void save.run(true)} disabled={save.pending || saved || title.trim().length < 3}>
            {save.pending || saved ? <Spinner /> : <Send className="h-4 w-4" aria-hidden="true" />} Publish now
          </Button>
        )}
        <Button variant="secondary" onClick={() => void save.run(false)} disabled={save.pending || saved || title.trim().length < 3}>{published ? 'Save changes' : 'Save draft'}</Button>
        <Button variant="ghost" onClick={() => router.back()}><X className="h-4 w-4" aria-hidden="true" /> Cancel</Button>
      </div>
    </div>
  );
}
