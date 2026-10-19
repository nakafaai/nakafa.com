"use client";

import type { GenericId } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import {
  ResultsScopeContext,
  useSessionSettled,
} from "@/components/exams/results/context";
import { QuestionResults } from "@/components/exams/results/questions";
import { ReleaseCard } from "@/components/exams/results/release";
import { StudentsTable } from "@/components/exams/results/students";
import { SchoolHeader } from "@/components/tenant/header";

/**
 * The results of one sitting for its teacher: the release of the results, the students' list, and each
 * question's statistics and answers. The page shows the header, one row of it, and the release as the
 * page's one primary action. A viewer who may not read the results gets one sentence instead.
 */
export function SittingResults({
  examId,
  sittingId,
  slug,
}: {
  readonly examId: GenericId.GenericId<"exams">;
  readonly sittingId: GenericId.GenericId<"examSittings">;
  readonly slug: TenantSlug;
}) {
  const settled = useSessionSettled();
  const scope = useMemo(() => ({ sittingId, slug }), [sittingId, slug]);
  const overview = useQuery(
    exams.results.results.overview,
    settled ? scope : "skip"
  );

  if (QueryResult.isFailure(overview)) {
    return <ResultsRefusal />;
  }
  if (!QueryResult.isSuccess(overview)) {
    return null;
  }
  const { can, questions, releasedAt, sitting } = overview.value;
  if (sitting.examId !== examId) {
    return <ResultsRefusal />;
  }
  const canRelease =
    sitting.state === "closed" && Arr.contains(can, "result.release");
  return (
    <ResultsScopeContext value={scope}>
      <ResultsHeader
        examId={examId}
        examTitle={sitting.examTitle}
        room={sitting.room}
        sittingId={sittingId}
      />
      <div className="grid min-w-0 content-start gap-4 p-4 md:p-6">
        <ReleaseCard canRelease={canRelease} releasedAt={releasedAt} />
        <StudentsTable timeZone={sitting.timeZone} total={questions.length} />
        <QuestionResults questions={questions} />
      </div>
    </ResultsScopeContext>
  );
}

/** The one header of the results page: the path from the exams through the exam and the room to the results. */
function ResultsHeader({
  examId,
  examTitle,
  room,
  sittingId,
}: {
  readonly examId: GenericId.GenericId<"exams">;
  readonly examTitle: string;
  readonly room: string;
  readonly sittingId: GenericId.GenericId<"examSittings">;
}) {
  const t = useTranslations("Exams");

  return (
    <SchoolHeader
      items={[
        { href: "/exams", label: t("title") },
        { href: `/exams/${examId}/edit`, label: examTitle },
        { href: `/exams/${examId}/sittings/${sittingId}`, label: room },
        { label: t("results-title") },
      ]}
      title={t("results-title")}
    />
  );
}

/** The page when the results cannot be shown: the header with the way back to the exams, and one sentence. */
function ResultsRefusal() {
  const t = useTranslations("Exams");

  return (
    <>
      <SchoolHeader
        items={[{ href: "/exams", label: t("title") }]}
        title={t("results-title")}
      />
      <p className="p-4 text-muted-foreground text-sm md:p-6">
        {t("results-unavailable")}
      </p>
    </>
  );
}
