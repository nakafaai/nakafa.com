"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Preloaded } from "convex/react";
import { useConvexAuth, usePreloadedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { useTryoutClock } from "@/components/tryout/clock";
import type { TryoutQuestionContent } from "@/components/tryout/content";
import { TryoutPageHeader } from "@/components/tryout/header";
import { TryoutMeta } from "@/components/tryout/meta";
import {
  getTryoutHref,
  getTryoutPublicPathHref,
} from "@/components/tryout/routes";
import { TryoutRuntime } from "@/components/tryout/runtime.client";
import { TryoutSetAction } from "@/components/tryout/set-action.client";
import { TryoutSectionRows } from "@/components/tryout/set-sections.client";

interface TryoutSetPageClientProps {
  country: string;
  entryQuestions: readonly TryoutQuestionContent[];
  exam: string;
  locale: Locale;
  preloaded: Preloaded<SetPageQuery>;
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
          setKey: page.set.setKey,
          trackKey: page.set.trackKey,
        }
      : "skip"
  );
  const shouldLoadRuntime =
    page !== null &&
    entrySection !== null &&
    isInternalEntry &&
    isAuthenticated &&
    !isLoading &&
    attempt !== undefined &&
    attempt !== null;
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
  const tCommon = useTranslations("Common");
  const tTryouts = useTranslations("Tryouts");
  const currentAttempt = isAuthenticated ? attempt : null;
  const now = useTryoutClock(currentAttempt?.status === "in-progress");

  if (!page) {
    return null;
  }

  const activeAttempt = getActiveAttempt(currentAttempt ?? null, now);
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
        set: page.set.setKey,
        track,
      })
    : getTryoutHref({ country, exam, set: page.set.setKey, track });
  const activeRuntime = isInternalEntry
    ? getActiveRuntime(runtime ?? null, activeAttempt, now)
    : null;
  const reviewRuntime =
    isInternalEntry && runtime?.section.status !== "in-progress"
      ? runtime
      : null;
  const runtimeContent = activeRuntime ?? reviewRuntime;

  if (runtimeContent && entryQuestions.length === 0) {
    return null;
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
              set: page.set.setKey,
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
