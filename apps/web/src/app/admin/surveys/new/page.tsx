'use client';

import { SurveyBuilder } from '@/components/admin/survey-builder';
import { SectionHeader } from '@/components/ui/layout';

export default function NewSurveyPage() {
  return (
    <div>
      <SectionHeader title="New survey" description="Save it as a draft or publish it now. People are notified when it goes live." className="mx-auto max-w-3xl" />
      <SurveyBuilder />
    </div>
  );
}
