"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import type { Preloaded } from "convex/react";
import { useConvexAuth, usePreloadedQuery, useQuery } from "convex/react";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { isTryoutActive } from "@/components/tryout/active";
import { useTryoutClock } from "@/components/tryout/clock";
import type { TryoutQuestionContent } from "@/components/tryout/content";
import { TryoutPageHeader } from "@/components/tryout/header";
import { TryoutMeta } from "@/components/tryout/meta";
import { getTryoutHref } from "@/components/tryout/routes";
import { TryoutRuntime } from "@/components/tryout/runtime.client";
import { TryoutSectionSummary } from "@/components/tryout/summary.client";

type SectionPageQuery = typeof api.tryouts.queries.catalog.getSectionPage;
type SectionRuntimeQuery = typeof api.tryouts.queries.attempt.getSectionRuntime;

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
  const now = useTryoutClock(
    attempt?.status === "in-progress" ||
      runtime?.section.status === "in-progress"
  );

  if (!page || isLoading || (isAuthenticated && attempt === undefined)) {
    return null;
  }

  const currentAttempt = attempt ?? null;
  const sectionAttempt = currentAttempt?.section ?? null;
  const sectionExpiredLocally = Boolean(
    sectionAttempt?.status === "in-progress" && now >= sectionAttempt.expiresAt
  );
  let activeAttempt: typeof currentAttempt = null;

  if (
    currentAttempt &&
    isTryoutActive({
      expiresAt: currentAttempt.expiresAt,
      now,
      status: currentAttempt.status,
    })
  ) {
    activeAttempt = currentAttempt;
  }

  let activeSection: NonNullable<
    NonNullable<typeof currentAttempt>["section"]
  > | null = null;

  if (
    activeAttempt?.section &&
    isTryoutActive({
      expiresAt: activeAttempt.section.expiresAt,
      now,
      status: activeAttempt.section.status,
    })
  ) {
    activeSection = activeAttempt.section;
  }

  let activeRuntime: typeof runtime | null = null;

  if (
    activeSection &&
    runtime &&
    isTryoutActive({
      expiresAt: runtime.expiresAt,
      now,
      status: runtime.section.status,
    })
  ) {
    activeRuntime = runtime;
  }

  if (activeSection && !activeRuntime) {
    return null;
  }

  if (activeRuntime && questions.length === 0) {
    return null;
  }

  const sectionFinished = Boolean(
    sectionAttempt &&
      (sectionAttempt.status === "completed" ||
        sectionAttempt.status === "expired" ||
        sectionExpiredLocally)
  );
  const sectionTimeExpired = Boolean(
    sectionAttempt &&
      (sectionAttempt.endReason === "time-expired" ||
        sectionAttempt.status === "expired" ||
        sectionExpiredLocally)
  );
  const attemptFinished = Boolean(
    currentAttempt &&
      !isTryoutActive({
        expiresAt: currentAttempt.expiresAt,
        now,
        status: currentAttempt.status,
      })
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
      attempt={currentAttempt}
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
