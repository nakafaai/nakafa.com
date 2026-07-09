"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Preloaded } from "convex/react";
import { useConvexAuth, usePreloadedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { useTryoutClock } from "@/components/tryout/clock";
import type { TryoutQuestionContent } from "@/components/tryout/content";
import { getTryoutFinishedSectionStatus } from "@/components/tryout/finished-status";
import { TryoutPageHeader } from "@/components/tryout/header";
import { TryoutMeta } from "@/components/tryout/meta";
import {
  getTryoutHref,
  getTryoutPublicPathHref,
} from "@/components/tryout/routes";
import { TryoutRuntime } from "@/components/tryout/runtime.client";
import { TryoutSetAction } from "@/components/tryout/set-action.client";
import { TryoutSectionRows } from "@/components/tryout/set-sections.client";
import { TryoutEntrySummary } from "@/components/tryout/summary.client";

interface TryoutSetPageClientProps {
  country: string;
  entryQuestions: readonly TryoutQuestionContent[];
  exam: string;
  locale: Locale;
  preloaded: Preloaded<SetPageQuery>;
  set: string;
  track: string;
}

type SetPageQuery = typeof api.tryouts.queries.catalog.getSetPage;
type SectionRuntimeQuery = typeof api.tryouts.queries.attempt.getSectionRuntime;
type SetPage = NonNullable<FunctionReturnType<SetPageQuery>>;
type SetEntrySection = NonNullable<SetPage["entrySection"]>;
type CurrentAttempt = FunctionReturnType<
  typeof api.tryouts.queries.attempt.getCurrent
>;
type SectionRuntime = FunctionReturnType<SectionRuntimeQuery>;

/** Renders one realtime try-out set page from Convex. */
export function TryoutSetPageClient({
  country,
  entryQuestions,
  exam,
  locale,
  preloaded,
  set,
  track,
}: TryoutSetPageClientProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const page = usePreloadedQuery(preloaded);
  const entrySection = page?.entrySection ?? null;
  const isInternalEntry = entrySection?.visibility === "internal-entry";
  const attempt = useQuery(
    api.tryouts.queries.attempt.getCurrent,
    page && isAuthenticated && !isLoading
      ? {
          countryKey: page.set.countryKey,
          examKey: page.set.examKey,
          locale,
          ...(isInternalEntry ? { sectionKey: entrySection.sectionKey } : {}),
          setKey: page.set.setKey,
          trackKey: page.set.trackKey,
        }
      : "skip"
  );
  const tCommon = useTranslations("Common");
  const tTryouts = useTranslations("Tryouts");
  const currentAttempt = isAuthenticated ? attempt : null;
  const now = useTryoutClock(currentAttempt?.status === "in-progress");
  const activeAttempt = getActiveAttempt(currentAttempt ?? null, now);
  const shouldLoadRuntime =
    page !== null &&
    entrySection !== null &&
    isInternalEntry &&
    isAuthenticated &&
    !isLoading &&
    attempt !== undefined &&
    activeAttempt !== null;
  const runtime = useQuery(
    api.tryouts.queries.attempt.getSectionRuntime,
    shouldLoadRuntime
      ? {
          countryKey: page.set.countryKey,
          examKey: page.set.examKey,
          locale,
          sectionKey: entrySection.sectionKey,
          setKey: page.set.setKey,
          trackKey: page.set.trackKey,
        }
      : "skip"
  );

  if (!page) {
    return null;
  }

  const actionAttempt =
    currentAttempt?.status === "in-progress" && !activeAttempt
      ? null
      : currentAttempt;

  const resumeSectionKey = activeAttempt?.resumeSectionKey ?? null;
  const resumeSection =
    page.sections.find(
      (sectionItem) => sectionItem.sectionKey === resumeSectionKey
    ) ?? entrySection;
  const entryHref = resumeSection
    ? getEntrySectionHref({
        country,
        entrySection: resumeSection,
        exam,
        set,
        track,
      })
    : getTryoutHref({ country, exam, set, track });
  const activeRuntime = isInternalEntry
    ? getActiveRuntime(runtime ?? null, activeAttempt, now)
    : null;
  const runtimeContent = activeRuntime;
  const hasActiveEntrySection =
    isInternalEntry && activeAttempt?.section?.status === "in-progress";

  if (isInternalEntry && isAuthenticated && attempt === undefined) {
    return null;
  }

  if (hasActiveEntrySection && !activeRuntime) {
    return null;
  }

  if (runtimeContent && entryQuestions.length === 0) {
    return null;
  }

  if (isInternalEntry && entrySection) {
    return (
      <TryoutInternalEntrySetPage
        activeAttempt={activeAttempt}
        activeRuntime={activeRuntime}
        country={country}
        currentAttempt={actionAttempt}
        entryQuestions={entryQuestions}
        entrySection={entrySection}
        exam={exam}
        locale={locale}
        page={page}
        set={set}
        track={track}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
      <div className="space-y-10">
        <div className="space-y-6">
          <TryoutPageHeader
            description={page.set.description ?? tTryouts("slug-description")}
            link={{
              href: getTryoutHref({ country, exam, track }),
              label: tCommon("back"),
            }}
            meta={
              <TryoutMeta
                items={[page.exam.title, page.track.title, page.set.title]}
              />
            }
            title={page.set.title}
          />

          <TryoutSetAction
            activeAttempt={activeAttempt}
            countryKey={page.set.countryKey}
            currentAttempt={actionAttempt}
            entryHref={entryHref}
            entrySection={entrySection}
            examKey={page.set.examKey}
            locale={locale}
            setKey={page.set.setKey}
            trackKey={page.set.trackKey}
          />
        </div>

        {runtimeContent ? (
          <TryoutRuntime
            isExpired={runtimeContent.section.status !== "in-progress"}
            questions={entryQuestions}
            returnHref={getTryoutHref({
              country,
              exam,
              set,
              track,
            })}
            runtime={runtimeContent}
          />
        ) : null}

        {page.sections.length > 0 ? (
          <TryoutSectionRows
            attempt={actionAttempt}
            emptyLabel={tTryouts("list-empty")}
            questionUnitLabel={tTryouts("question-unit")}
            sections={page.sections}
          />
        ) : null}
      </div>
    </div>
  );
}

/** Renders a no-nested-section set as the directly startable section surface. */
function TryoutInternalEntrySetPage({
  activeAttempt,
  activeRuntime,
  country,
  currentAttempt,
  entryQuestions,
  entrySection,
  exam,
  locale,
  page,
  set,
  track,
}: {
  activeAttempt: NonNullable<CurrentAttempt> | null;
  activeRuntime: NonNullable<SectionRuntime> | null;
  country: string;
  currentAttempt?: CurrentAttempt;
  entryQuestions: readonly TryoutQuestionContent[];
  entrySection: SetEntrySection;
  exam: string;
  locale: Locale;
  page: SetPage;
  set: string;
  track: string;
}) {
  const tCommon = useTranslations("Common");
  const tTryouts = useTranslations("Tryouts");
  const entryHref = getTryoutHref({ country, exam, set, track });
  const parentHref = getTryoutHref({ country, exam, track });
  const runtimeContent = activeRuntime;
  const sectionAttempt = currentAttempt?.section ?? null;
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
  let status = tTryouts("entry-head-ready");

  if (activeRuntime) {
    status = tTryouts("part-head-in-progress");
  } else if (sectionFinished) {
    status = getTryoutFinishedSectionStatus({
      attemptFinished,
      sectionTimeExpired,
      tTryouts,
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
      <div className="space-y-10">
        <TryoutPageHeader
          link={{
            href: parentHref,
            label: tCommon("back"),
          }}
          meta={
            <TryoutMeta
              items={[page.exam.title, page.track.title, page.set.title]}
            />
          }
          status={status}
          title={page.set.title}
        />

        <div className="space-y-12">
          <TryoutEntrySummary
            activeAttempt={activeAttempt}
            attempt={currentAttempt}
            completedAction="restart"
            locale={locale}
            returnHref={parentHref}
            section={entrySection}
            sectionFinished={sectionFinished}
            sectionHref={entryHref}
            set={page.set}
            startAttemptSectionKey={entrySection.sectionKey}
          />

          {runtimeContent ? (
            <TryoutRuntime
              isExpired={runtimeContent.section.status !== "in-progress"}
              questions={entryQuestions}
              returnHref={entryHref}
              runtime={runtimeContent}
            />
          ) : null}
        </div>
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

/** Builds the href for either a visible public section or an internal set entry. */
function getEntrySectionHref({
  country,
  entrySection,
  exam,
  set,
  track,
}: {
  country: string;
  entrySection: SetEntrySection;
  exam: string;
  set: string;
  track: string;
}) {
  if (entrySection.publicPath) {
    return getTryoutPublicPathHref(entrySection.publicPath);
  }

  return getTryoutHref({ country, exam, set, track });
}
