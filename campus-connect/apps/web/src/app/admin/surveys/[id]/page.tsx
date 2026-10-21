'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ArrowLeft, Lock, Pencil, Send, ShieldCheck, Square, Star, Trash2, Users } from 'lucide-react';
import { del, get, patch } from '@/lib/api/client';
import { invalidate, useAction, useQuery } from '@/lib/api/hooks';
import type { AdminSurveyDetail, SurveyAnswer, SurveyResults, SurveySummary } from '@/lib/api/modules';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClass } from '@/components/ui/button';
import { Card, EmptyState, SectionHeader } from '@/components/ui/layout';
import { ConfirmDialog, ErrorState, FormAlert, SkeletonList } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Reveal, motion } from '@/components/motion';
import { DownloadButtons, Figure } from '@/components/admin/admin-ui';
import { SurveyBuilder } from '@/components/admin/survey-builder';
import { ROLE_LABEL } from '@/lib/roles';
import { ago, dateTime } from '@/lib/live-time';

function Bar({ label, count, percent }: { label: string; count: number; percent: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between gap-3 text-[14px]"><span className="min-w-0 truncate">{label}</span><span className="font-sans shrink-0 tabular-nums text-text-3">{count} · {percent}%</span></div>
      <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
        <motion.div initial={{ width: 0 }} animate={{ width: `${percent}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} className="h-full rounded-full bg-accent" />
      </div>
    </div>
  );
}

function QuestionResult({ s, index }: { s: SurveySummary; index: number }) {
  return (
    <Card className="space-y-3 p-4">
      <div>
        <p className="font-sans text-[12px] font-semibold text-text-3">Question {index + 1} · {s.answered} answered</p>
        <p className="font-semibold">{s.prompt}</p>
      </div>
      {(s.type === 'single' || s.type === 'multiple') && <div className="space-y-2.5">{s.options.map((o) => <Bar key={o.option} label={o.option} count={o.count} percent={o.percent} />)}</div>}
      {(s.type === 'rating' || s.type === 'scale') && (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <p className="font-sans text-[32px] font-bold leading-none tabular-nums">{s.average ?? '—'}<span className="text-[15px] font-semibold text-text-3"> / {s.type === 'rating' ? 5 : 10}</span></p>
            {s.type === 'rating' && s.average !== null && <span className="flex gap-0.5 text-warning" aria-hidden="true">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={n <= Math.round(s.average!) ? 'h-5 w-5 fill-current' : 'h-5 w-5'} />)}</span>}
            {s.nps !== null && <Badge tone={s.nps >= 30 ? 'success' : s.nps >= 0 ? 'warning' : 'danger'}>NPS {s.nps}</Badge>}
          </div>
          <div className="space-y-2">
            {s.distribution.map((d) => {
              const total = s.distribution.reduce((n, x) => n + x.count, 0) || 1;
              return <Bar key={d.value} label={s.type === 'rating' ? `${d.value} star${d.value === 1 ? '' : 's'}` : String(d.value)} count={d.count} percent={Math.round((d.count / total) * 100)} />;
            })}
          </div>
        </>
      )}
      {s.type === 'text' && (s.latest.length ? <ul className="space-y-2">{s.latest.map((t, i) => <li key={i} className="rounded-xl bg-surface-2 px-3 py-2 text-[14px]">“{t}”</li>)}</ul> : <p className="text-[13px] text-text-3">No written answers yet.</p>)}
    </Card>
  );
}

function show(a: SurveyAnswer | undefined): string {
  if (a === undefined || a === '') return '—';
  return Array.isArray(a) ? a.join(', ') : String(a);
}

function SurveyInner() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const editing = params.get('edit') === '1';
  const survey = useQuery<AdminSurveyDetail>(`admin:surveys:one:${id}`, (signal) => get(`/admin/surveys/${id}`, undefined, signal));
  const results = useQuery<SurveyResults>(survey.data && survey.data.status !== 'draft' ? `admin:surveys:results:${id}` : null, (signal) => get(`/admin/surveys/${id}/results`, undefined, signal));
  const [deleting, setDeleting] = useState(false);
  const setStatus = useAction(async (status: 'published' | 'closed') => {
    const r = await patch<{ notified: number }>(`/admin/surveys/${id}`, { status });
    toast(status === 'published' ? `Published. ${r.notified} notified.` : 'Survey closed. It no longer takes answers.');
    invalidate('admin:surveys', 'admin:overview', 'surveys:');
    survey.reload();
  });
  const remove = useAction(async () => {
    await del(`/admin/surveys/${id}`);
    router.replace('/admin/surveys');
    invalidate('admin:surveys:list', 'admin:overview', 'surveys:');
  });

  if (survey.loading) return <SkeletonList variant="card" count={2} />;
  if (survey.error) return <ErrorState error={survey.error} onRetry={survey.reload} />;
  const s = survey.data!;
  if (editing) {
    return (
      <div>
        <SectionHeader title="Edit survey" className="mx-auto max-w-3xl" />
        <SurveyBuilder survey={s} />
      </div>
    );
  }
  const r = results.data;
  return (
    <div className="space-y-6">
      <Link href="/admin/surveys" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-text-2"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> All surveys</Link>
      <Reveal className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={s.status === 'published' ? 'success' : s.status === 'closed' ? 'warning' : 'neutral'}>{s.status === 'published' ? 'Live' : s.status === 'closed' ? 'Closed' : 'Draft'}</Badge>
          {s.compulsory && <Badge tone="danger" icon={<Lock className="h-3.5 w-3.5" aria-hidden="true" />}>Compulsory</Badge>}
          {s.anonymous && <Badge tone="info" icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />}>Anonymous</Badge>}
        </div>
        <h2 className="text-[26px] font-bold leading-tight">{s.title}</h2>
        {s.description && <p className="text-[15px] text-text-2">{s.description}</p>}
        <p className="flex items-center gap-1.5 text-[13px] text-text-3"><Users className="h-4 w-4" aria-hidden="true" /> {s.audienceRoles.length ? s.audienceRoles.map((x) => ROLE_LABEL[x]).join(', ') : 'Everyone'} · {s.questions?.length ?? 0} questions · {s.publishedAt ? `published ${ago(s.publishedAt)}` : `created ${ago(s.createdAt)}`}{s.closesAt ? ` · closes ${dateTime(s.closesAt)}` : ''}</p>
        <div className="flex flex-wrap gap-2">
          {s.status === 'draft' && <Button size="sm" onClick={() => void setStatus.run('published')} disabled={setStatus.pending}><Send className="h-4 w-4" aria-hidden="true" /> Publish now</Button>}
          {s.status === 'published' && <Button size="sm" variant="secondary" onClick={() => void setStatus.run('closed')} disabled={setStatus.pending}><Square className="h-4 w-4" aria-hidden="true" /> Close survey</Button>}
          {s.status === 'closed' && <Button size="sm" variant="secondary" onClick={() => void setStatus.run('published')} disabled={setStatus.pending}><Send className="h-4 w-4" aria-hidden="true" /> Reopen</Button>}
          {s.status !== 'closed' && <Link href={`/admin/surveys/${id}?edit=1`} className={buttonClass({ size: 'sm', variant: 'secondary' })}><Pencil className="h-4 w-4" aria-hidden="true" /> Edit</Link>}
          <Button size="sm" variant="danger" onClick={() => setDeleting(true)}><Trash2 className="h-4 w-4" aria-hidden="true" /> Delete</Button>
        </div>
        {setStatus.error && <FormAlert>{setStatus.error.message}</FormAlert>}
      </Reveal>

      {s.status === 'draft' ? (
        <EmptyState icon={Send} title="Not published yet" description="Publish it to notify people. Results show here as answers come in." />
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <Figure label="Answers" value={s.responsesCount} />
            <Figure label="Questions" value={s.questions?.length ?? 0} />
            <Figure label="Status" value={s.status === 'published' ? 'Live' : 'Closed'} tone={s.status === 'published' ? 'success' : 'warning'} />
          </div>
          <DownloadButtons path={`/admin/surveys/${id}/export`} label="Download results" />
          {results.loading && <SkeletonList variant="card" count={2} />}
          {results.error && <ErrorState error={results.error} onRetry={results.reload} />}
          {r && !r.survey.responsesCount && <EmptyState icon={Users} title="No answers yet" description={s.compulsory ? 'People see this survey as soon as they open the app.' : 'People were notified. Answers show up here.'} />}
          {r && r.survey.responsesCount > 0 && (
            <>
              <section className="space-y-3">
                <SectionHeader title="Summary" />
                {r.summary.map((q, i) => <QuestionResult key={q.questionId} s={q} index={i} />)}
              </section>
              <section>
                <SectionHeader title="Individual answers" description={r.survey.anonymous ? 'Anonymous: names are never recorded.' : `Latest ${r.responses.length}`} />
                <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
                  <table className="w-full min-w-[640px] text-left text-[13px]">
                    <thead className="font-sans bg-surface-2 text-[12px] uppercase tracking-wide text-text-3">
                      <tr>
                        <th className="px-3 py-2">When</th>
                        {!r.survey.anonymous && <th className="px-3 py-2">Who</th>}
                        {r.survey.questions.map((q, i) => <th key={q.id} className="px-3 py-2" title={q.prompt}>Q{i + 1}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {r.responses.map((row) => (
                        <tr key={row.id}>
                          <td className="whitespace-nowrap px-3 py-2 text-text-3">{ago(row.submittedAt)}</td>
                          {!r.survey.anonymous && <td className="whitespace-nowrap px-3 py-2">{row.respondent?.displayName ?? '—'}</td>}
                          {r.survey.questions.map((q) => <td key={q.id} className="max-w-[240px] px-3 py-2 align-top">{show(row.answers[q.id])}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}
      <ConfirmDialog open={deleting} onClose={() => setDeleting(false)} onConfirm={() => void remove.run()} title="Delete this survey?" description={s.responsesCount ? `Its ${s.responsesCount} answers are deleted too. Download them first if you need them.` : 'This cannot be undone.'} confirmLabel="Delete survey" danger pending={remove.pending} error={remove.error?.message} />
    </div>
  );
}

export default function AdminSurveyPage() {
  return (
    <Suspense fallback={<SkeletonList variant="card" count={2} />}>
      <SurveyInner />
    </Suspense>
  );
}
