'use client';

import Link from 'next/link';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ClipboardList } from 'lucide-react';
import { get } from '@/lib/api/client';
import { invalidate, useQuery } from '@/lib/api/hooks';
import type { SurveyView } from '@/lib/api/modules';
import { Badge } from '@/components/ui/badge';
import { buttonClass } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/layout';
import { ErrorState, SkeletonList } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Reveal } from '@/components/motion';
import { SurveyForm } from '@/components/surveys/survey-form';
import { day } from '@/lib/live-time';

export default function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const survey = useQuery<SurveyView>(`surveys:one:${id}`, (signal) => get(`/surveys/${id}`, undefined, signal));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 md:px-8 md:pb-12">
      <PageHeader title="Survey" back backHref="/feedback" />
      {survey.loading && <SkeletonList variant="card" count={2} />}
      {survey.error && <ErrorState error={survey.error} onRetry={survey.reload} />}
      {survey.data && (
        <Reveal>
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-soft-ink">
              <ClipboardList className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[24px] font-bold leading-tight">{survey.data.title}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-text-3">
                {survey.data.compulsory && <Badge tone="danger">Required</Badge>}
                {survey.data.anonymous && <Badge>Anonymous</Badge>}
                {survey.data.closesAt && <span>Closes {day(survey.data.closesAt)}</span>}
              </div>
              {survey.data.description && <p className="mt-2 text-[15px] text-text-2">{survey.data.description}</p>}
            </div>
          </div>
          <div className="mt-6">
            {survey.data.answered ? (
              <div className="rounded-2xl border border-border bg-surface p-6 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden="true" />
                <p className="mt-2 text-[17px] font-semibold">You have answered this survey</p>
                <p className="mt-1 text-[14px] text-text-2">Thank you for your feedback.</p>
                <Link href="/feedback" className={buttonClass({ variant: 'secondary', className: 'mt-4' })}>
                  Back to Feedback
                </Link>
              </div>
            ) : (
              <SurveyForm
                survey={survey.data}
                onDone={() => {
                  toast('Thank you, your answers were saved.');
                  invalidate('surveys:');
                  router.push('/feedback');
                }}
              />
            )}
          </div>
        </Reveal>
      )}
    </div>
  );
}
