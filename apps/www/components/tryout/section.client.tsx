"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import type { Preloaded } from "convex/react";
import { useConvexAuth, usePreloadedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useTryoutClock } from "@/components/tryout/clock";
import type { TryoutQuestionContent } from "@/components/tryout/content";
import { TryoutPageHeader } from "@/components/tryout/header";
import { TryoutMeta } from "@/components/tryout/meta";
import { getTryoutHref } from "@/components/tryout/routes";
import { TryoutRuntime } from "@/components/tryout/runtime.client";
import { TryoutSectionSummary } from "@/components/tryout/summary.client";

type SectionPageQuery = typeof api.tryouts.queries.catalog.getSectionPage;
type SectionRuntimeQuery = typeof api.tryouts.queries.attempt.getSectionRuntime;
type CurrentAttempt = FunctionReturnType<
  typeof api.tryouts.queries.attempt.getCurrent
>;
type SectionRuntime = FunctionReturnType<SectionRuntimeQuery>;

interface TryoutSectionPageClientProps {
  country: string;
  exam: string;
  locale: Locale;
  preloaded: Preloaded<SectionPageQuery>;
  questions: readonly TryoutQuestionContent[];
  runtime: Preloaded<SectionRuntimeQuery>;
  section: string;
  set: string;
}

/** Renders one realtime try-out section page from Convex. */
export function TryoutSectionPageClient({
  country,
  exam,
  locale,
  preloaded,
  questions,
  runtime: preloadedRuntime,
  section,
  set,
}: TryoutSectionPageClientProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const page = usePreloadedQuery(preloaded);
  const runtime = usePreloadedQuery(preloadedRuntime);
  const attempt = useQuery(
    api.tryouts.queries.attempt.getCurrent,
    page && isAuthenticated && !isLoading
      ? {
          countryKey: page.set.countryKey,
          examKey: page.set.examKey,
          locale,
          sectionKey: page.section.sectionKey,
          setKey: page.set.setKey,
        }
      : "skip"
  );
  const tCommon = useTranslations("Common");
  const tTryouts = useTranslations("Tryouts");
  const currentAttempt = attempt ?? null;
  const now = useTryoutClock(
    currentAttempt?.status === "in-progress" ||
      runtime?.section.status === "in-progress"
  );

  if (!page || isLoading || (isAuthenticated && attempt === undefined)) {
    return null;
  }

  const activeAttempt = getActiveAttempt(currentAttempt, now);
  const actionAttempt =
    currentAttempt?.status === "in-progress" && !activeAttempt
      ? null
      : currentAttempt;
  const sectionAttempt = actionAttempt?.section ?? null;
  const activeRuntime = getActiveRuntime(runtime, activeAttempt, now);
  const reviewRuntime =
    runtime && runtime.section.status !== "in-progress" ? runtime : null;
  const hasActiveSection = activeAttempt?.section?.status === "in-progress";

  if (hasActiveSection && !activeRuntime) {
    return null;
  }

  if (activeRuntime && questions.length === 0) {
    return null;
  }

  const sectionFinished = Boolean(
    sectionAttempt &&
      (sectionAttempt.status === "completed" ||
        sectionAttempt.status === "expired")
  );
  const sectionTimeExpired = Boolean(
    sectionAttempt &&
      (sectionAttempt.endReason === "time-expired" ||
        sectionAttempt.status === "expired")
  );
  const attemptFinished = Boolean(
    currentAttempt && currentAttempt.status !== "in-progress"
  );

  let status = tTryouts("part-head-needs-tryout");

  if (activeRuntime) {
    status = tTryouts("part-head-in-progress");
  } else if (sectionFinished) {
    status = getFinishedSectionStatus({
      attemptFinished,
      sectionTimeExpired,
      tTryouts,
    });
  } else if (activeAttempt) {
    status = tTryouts("part-head-ready");
  } else if (currentAttempt) {
    status = tTryouts("part-head-ended");
  }

  let sectionContent: ReactNode = (
    <TryoutSectionSummary
      activeAttempt={activeAttempt}
      attempt={actionAttempt}
      country={country}
      exam={exam}
      locale={locale}
      page={page}
      section={section}
      sectionFinished={sectionFinished}
      set={set}
    />
  );

  if (activeRuntime) {
    sectionContent = (
      <TryoutRuntime
        isExpired={false}
        questions={questions}
        returnHref={getTryoutHref({ country, exam, set })}
        runtime={activeRuntime}
        runtimeQueryArgs={{
          countryKey: page.set.countryKey,
          examKey: page.set.examKey,
          locale,
          sectionKey: page.section.sectionKey,
          setKey: page.set.setKey,
        }}
      />
    );
  } else if (reviewRuntime && questions.length > 0) {
    sectionContent = (
      <>
        {sectionContent}
        <TryoutRuntime
          isExpired={true}
          questions={questions}
          returnHref={getTryoutHref({ country, exam, set })}
          runtime={reviewRuntime}
          runtimeQueryArgs={{
            countryKey: page.set.countryKey,
            examKey: page.set.examKey,
            locale,
            sectionKey: page.section.sectionKey,
            setKey: page.set.setKey,
          }}
        />
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
      <div className="space-y-10">
        <TryoutPageHeader
          icon={getMaterialIcon(page.section.sectionKey)}
          link={{
            href: getTryoutHref({ country, exam, set }),
            label: tCommon("back"),
          }}
          meta={<TryoutMeta items={[page.exam.title, page.set.title]} />}
          status={status}
          title={page.section.title}
        />

        <div className="space-y-12">{sectionContent}</div>
      </div>
    </div>
  );
}

/** Returns the current attempt only while its Convex expiry is still active. */
function getActiveAttempt(attempt: CurrentAttempt, now: number) {
  if (attempt?.status !== "in-progress") {
    return null;
  }

  if (now >= attempt.expiresAt) {
    return null;
  }

  return attempt;
}

/** Returns an active section runtime only while both timers are still active. */
function getActiveRuntime(
  runtime: SectionRuntime,
  activeAttempt: NonNullable<CurrentAttempt> | null,
  now: number
) {
  if (!activeAttempt) {
    return null;
  }

  if (runtime?.section.status !== "in-progress") {
    return null;
  }

  if (now >= runtime.expiresAt) {
    return null;
  }

  return runtime;
}

/** Selects the production header copy for finished try-out sections. */
function getFinishedSectionStatus({
  attemptFinished,
  sectionTimeExpired,
  tTryouts,
}: {
  attemptFinished: boolean;
  sectionTimeExpired: boolean;
  tTryouts: ReturnType<typeof useTranslations>;
}) {
  if (sectionTimeExpired && attemptFinished) {
    return tTryouts("part-head-completed-time-expired");
  }

  if (sectionTimeExpired) {
    return tTryouts("part-head-completed-time-expired-pending-review");
  }

  if (attemptFinished) {
    return tTryouts("part-head-completed");
  }

  return tTryouts("part-head-completed-pending-review");
}
