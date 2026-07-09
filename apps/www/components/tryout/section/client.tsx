"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import type { Preloaded } from "convex/react";
import { useConvexAuth, usePreloadedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { TryoutQuestionContent } from "@/components/tryout/content/load";
import { getTryoutHref } from "@/components/tryout/route/path";
import { TryoutRuntime } from "@/components/tryout/runtime/client";
import { useTryoutClock } from "@/components/tryout/runtime/clock";
import { getTryoutFinishedSectionStatus } from "@/components/tryout/section/finished";
import { TryoutVisibleSummary } from "@/components/tryout/section/summary.client";
import { TryoutPageHeader } from "@/components/tryout/shell/header";
import { TryoutMeta } from "@/components/tryout/shell/meta";

type SectionPageQuery = typeof api.tryouts.queries.catalog.getSectionPage;
type SectionRuntimeQuery = typeof api.tryouts.queries.attempt.getSectionRuntime;
type CurrentAttempt = FunctionReturnType<
  typeof api.tryouts.queries.attempt.getCurrent
>;
type SectionRuntime = FunctionReturnType<SectionRuntimeQuery>;

interface TryoutSectionPageClientProps {
  content: TryoutSectionContent;
  preloaded: TryoutSectionPreloads;
  route: TryoutSectionRoute;
}

interface TryoutSectionContent {
  questions: readonly TryoutQuestionContent[];
}

interface TryoutSectionPreloads {
  page: Preloaded<SectionPageQuery>;
  runtime: Preloaded<SectionRuntimeQuery>;
}

interface TryoutSectionRoute {
  country: string;
  exam: string;
  locale: Locale;
  section: string;
  set: string;
  track: string;
}

/** Renders one realtime try-out section page from Convex. */
export function TryoutSectionPageClient({
  content,
  preloaded,
  route,
}: TryoutSectionPageClientProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const page = usePreloadedQuery(preloaded.page);
  const runtime = usePreloadedQuery(preloaded.runtime);
  const attempt = useQuery(
    api.tryouts.queries.attempt.getCurrent,
    page && isAuthenticated && !isLoading
      ? {
          countryKey: page.set.countryKey,
          examKey: page.set.examKey,
          locale: route.locale,
          sectionKey: page.section.sectionKey,
          setKey: page.set.setKey,
          trackKey: page.set.trackKey,
        }
      : "skip"
  );
  const tCommon = useTranslations("Common");
  const tTryouts = useTranslations("Tryouts");
  const currentAttempt = isAuthenticated ? attempt : null;
  const now = useTryoutClock(
    currentAttempt?.status === "in-progress" ||
      runtime?.section.status === "in-progress"
  );

  if (!page) {
    return null;
  }

  if (isLoading) {
    return null;
  }

  if (isAuthenticated && attempt === undefined) {
    return null;
  }

  const activeAttempt = getActiveAttempt(currentAttempt ?? null, now);
  const actionAttempt =
    currentAttempt?.status === "in-progress" && !activeAttempt
      ? null
      : currentAttempt;
  const sectionAttempt = actionAttempt?.section ?? null;
  const activeRuntime = getActiveRuntime(runtime, activeAttempt, now);
  const reviewRuntime =
    runtime && runtime.section.status !== "in-progress" ? runtime : null;
  const hasActiveSection = activeAttempt?.section?.status === "in-progress";
  const setHref = getTryoutHref({
    country: route.country,
    exam: route.exam,
    set: route.set,
    track: route.track,
  });

  if (hasActiveSection && !activeRuntime) {
    return null;
  }

  if (activeRuntime && content.questions.length === 0) {
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
    status = getTryoutFinishedSectionStatus({
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
    <TryoutVisibleSummary
      value={{
        activeAttempt,
        attempt: actionAttempt,
        locale: route.locale,
        page,
        route,
        sectionFinished,
      }}
    />
  );

  if (activeRuntime) {
    sectionContent = (
      <TryoutRuntime
        value={{
          expired: false,
          questions: content.questions,
          returnHref: setHref,
          runtime: activeRuntime,
        }}
      />
    );
  } else if (reviewRuntime && content.questions.length > 0) {
    sectionContent = (
      <>
        {sectionContent}
        <TryoutRuntime
          value={{
            expired: true,
            questions: content.questions,
            returnHref: setHref,
            runtime: reviewRuntime,
          }}
        />
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
      <div className="space-y-10">
        <TryoutPageHeader
          value={{
            icon: getMaterialIcon(page.section.sectionKey),
            link: {
              href: setHref,
              label: tCommon("back"),
            },
            meta: (
              <TryoutMeta
                items={[page.exam.title, page.track.title, page.set.title]}
              />
            ),
            status,
            title: page.section.title,
          }}
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
