"use client";

import type { SittingView } from "@repo/backend/confect/exams/sittings/contract";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { StudentResults } from "@/components/exams/results/student";
import type { AttemptValue } from "@/components/exams/sitting/attempt";
import { SittingBar } from "@/components/exams/sitting/bar";
import { forgetKeptAttempt } from "@/components/exams/sitting/kept.client";
import { LayoutContent } from "@/components/shared/content/layout";

/** The copy key of each state of an attempt that takes no answers. */
const sentenceKeys = {
  closing: "student-attempt-closed",
  locked: "student-locked",
  submitted: "answers-in",
} satisfies Record<
  Exclude<AttemptValue["state"], "inProgress">,
  "answers-in" | "student-attempt-closed" | "student-locked"
>;

/**
 * An attempt that takes no answers, shown without an entry: the exam's name, the one sentence of its state,
 * and the student's own results once the teacher releases them. A submitted attempt no longer keeps any
 * answer in the browser, because the server holds them all, so the kept state is dropped here.
 */
export function StudentOutcome({
  attempt,
  sitting,
  slug,
}: {
  readonly attempt: AttemptValue;
  readonly sitting: typeof SittingView.Type;
  readonly slug: TenantSlug;
}) {
  const t = useTranslations("Exams");

  useEffect(() => {
    if (attempt.state === "submitted") {
      forgetKeptAttempt(sitting.id, attempt.id);
    }
  }, [attempt.id, attempt.state, sitting.id]);

  return (
    <>
      <SittingBar examTitle={sitting.examTitle} />
      <LayoutContent className="grid w-full gap-6 py-6">
        {attempt.state === "inProgress" ? null : (
          <p>{t(sentenceKeys[attempt.state])}</p>
        )}
        {attempt.state === "submitted" ? (
          <StudentResults sittingId={sitting.id} slug={slug} />
        ) : null}
      </LayoutContent>
    </>
  );
}
