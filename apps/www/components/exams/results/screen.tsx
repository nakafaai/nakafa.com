"use client";

import type { GenericId } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr } from "effect";
import { useMemo } from "react";
import { useTranslations } from "use-intl";
import {
  ResultsPaperContext,
  ResultsScopeContext,
  useSessionSettled,
} from "@/components/exams/results/context";
import { QuestionResults } from "@/components/exams/results/questions";
import { ReleaseCard } from "@/components/exams/results/release";
import { StudentsTable } from "@/components/exams/results/students";
import { useTenant } from "@/components/tenant/context";
import { SchoolHeader } from "@/components/tenant/header";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { isDenied, isLostAccess } from "@/components/tenant/refusal";

/**
 * The results of one sitting for its teacher: the release of the results, the students' list, and each
 * question's statistics and answers. The page shows the header, one row of it, and the release as the
 * page's one primary action. A viewer who may not read the results gets one sentence instead. A failed
 * read shows its own sentence and Try again in place of the page, and a viewer who lost the school's
 * access is sent to the refused page.
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
  const scope = useMemo(() => ({ sittingId, slug }), [sittingId, slug]);

  return (
    <ReadBoundary
      fallback={(failure) => (
        <>
          <ExamsCrumbHeader />
          <div className="p-4 md:p-6">{failure}</div>
        </>
      )}
      read={{ args: scope, ref: exams.results.results.overview }}
    >
      <SittingResultsContent examId={examId} scope={scope} />
    </ReadBoundary>
  );
}

/** The results of one sitting once its overview is in: the release, the students, and the questions. */
function SittingResultsContent({
  examId,
  scope,
}: {
  readonly examId: GenericId.GenericId<"exams">;
  readonly scope: {
    readonly sittingId: GenericId.GenericId<"examSittings">;
    readonly slug: TenantSlug;
  };
}) {
  const settled = useSessionSettled();
  const overview = useQuery(
    exams.results.results.overview,
    settled ? scope : "skip"
  );
  const timeZone = QueryResult.isSuccess(overview)
    ? overview.value.sitting.timeZone
    : "";
  const total = QueryResult.isSuccess(overview)
    ? overview.value.questions.length
    : 0;
  const paper = useMemo(() => ({ timeZone, total }), [timeZone, total]);

  if (QueryResult.isFailure(overview)) {
    if (isLostAccess(overview.error)) {
      throw overview.error;
    }
    if (isDenied(overview.error)) {
      return <ResultsRefusal />;
    }
    throw overview.error;
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
        sittingId={scope.sittingId}
      />
      <div className="grid min-w-0 content-start gap-4 p-4 md:p-6">
        <ReleaseCard canRelease={canRelease} releasedAt={releasedAt} />
        <ResultsPaperContext value={paper}>
          <StudentsTable />
        </ResultsPaperContext>
        <QuestionResults questions={questions} />
      </div>
    </ResultsScopeContext>
  );
}

/**
 * The crumbs that lead to the exam: the exam list and the exam's editor for a viewer who may open
 * them, and the exam's rooms for a viewer who may only read the rooms. A link the viewer may not
 * open would answer not found, so the crumbs follow the tenant's access.
 */
function useExamCrumbs(
  examId: GenericId.GenericId<"exams">,
  examTitle: string
) {
  const t = useTranslations("Exams");
  const tenant = useTenant();

  return tenant.canOpenExams
    ? [
        { href: "/exams", label: t("title") },
        { href: `/exams/${examId}/edit`, label: examTitle },
      ]
    : [{ href: `/exams/${examId}`, label: examTitle }];
}

/** The one header of the results page: the path from the exam through the room to the results. */
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
  const crumbs = useExamCrumbs(examId, examTitle);

  return (
    <SchoolHeader
      items={[
        ...crumbs,
        { href: `/exams/${examId}/sittings/${sittingId}`, label: room },
        { label: t("results-title") },
      ]}
      title={t("results-title")}
    />
  );
}

/** The header of a results page that cannot show its exam: the way back to the exam list, for a viewer who may open it. */
function ExamsCrumbHeader() {
  const t = useTranslations("Exams");
  const tenant = useTenant();

  return (
    <SchoolHeader
      items={tenant.canOpenExams ? [{ href: "/exams", label: t("title") }] : []}
      title={t("results-title")}
    />
  );
}

/** The page when the results cannot be shown: the header with the way back to the exams, and one sentence. */
function ResultsRefusal() {
  const t = useTranslations("Exams");

  return (
    <>
      <ExamsCrumbHeader />
      <p className="p-4 text-muted-foreground text-sm md:p-6">
        {t("results-unavailable")}
      </p>
    </>
  );
}
