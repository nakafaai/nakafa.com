"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Preloaded } from "convex/react";
import { useConvexAuth, usePreloadedQuery, useQuery } from "convex/react";
import {
  getTryoutHref,
  getTryoutPublicPathHref,
} from "@/components/tryout/route/path";
import { useTryoutClock } from "@/components/tryout/runtime/clock";
import { TryoutSetEntry } from "@/components/tryout/set/entry";
import type {
  CurrentAttempt,
  SectionRuntime,
  SetEntrySection,
  SetPageQuery,
  TryoutSetContent,
  TryoutSetRoute,
  TryoutSetView,
} from "@/components/tryout/set/model";
import { TryoutSetOverview } from "@/components/tryout/set/overview";

interface TryoutSetPageClientProps {
  content: TryoutSetContent;
  preloaded: Preloaded<SetPageQuery>;
  route: TryoutSetRoute;
}

/** Renders one realtime try-out set page from Convex. */
export function TryoutSetPageClient({
  content,
  preloaded,
  route,
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
          locale: route.locale,
          ...(isInternalEntry ? { sectionKey: entrySection.sectionKey } : {}),
          setKey: page.set.setKey,
          trackKey: page.set.trackKey,
        }
      : "skip"
  );
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
    isEntrySectionRuntimeAvailable(currentAttempt ?? null, activeAttempt);
  const runtime = useQuery(
    api.tryouts.queries.attempt.getSectionRuntime,
    shouldLoadRuntime
      ? {
          countryKey: page.set.countryKey,
          examKey: page.set.examKey,
          locale: route.locale,
          sectionKey: entrySection.sectionKey,
          setKey: page.set.setKey,
          trackKey: page.set.trackKey,
        }
      : "skip"
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

  const actionAttempt =
    currentAttempt?.status === "in-progress" && !activeAttempt
      ? null
      : currentAttempt;

  const resumeSectionKey = activeAttempt?.resumeSectionKey ?? null;
  const resumeSection =
    page.sections.find(
      (sectionItem) => sectionItem.sectionKey === resumeSectionKey
    ) ?? entrySection;
  const setHref = getTryoutHref(route);
  const entryHref = resumeSection
    ? getEntrySectionHref({
        entrySection: resumeSection,
        route,
      })
    : setHref;
  const activeRuntime = isInternalEntry
    ? getActiveRuntime(runtime ?? null, activeAttempt, now)
    : null;
  const reviewRuntime =
    isInternalEntry && runtime && runtime.section.status !== "in-progress"
      ? runtime
      : null;
  const runtimeContent = activeRuntime ?? reviewRuntime;
  const hasActiveEntrySection =
    isInternalEntry && activeAttempt?.section?.status === "in-progress";

  if (hasActiveEntrySection && !activeRuntime) {
    return null;
  }

  if (runtimeContent && content.entryQuestions.length === 0) {
    return null;
  }

  const view: TryoutSetView = {
    actionAttempt,
    activeAttempt,
    activeRuntime,
    content,
    entryHref,
    entrySection,
    page,
    reviewRuntime,
    route,
    runtimeContent,
  };

  if (isInternalEntry && entrySection) {
    return <TryoutSetEntry value={{ ...view, entrySection }} />;
  }

  return <TryoutSetOverview value={view} />;
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

/** Returns true when direct-entry pages can load active or review runtime. */
function isEntrySectionRuntimeAvailable(
  attempt: CurrentAttempt,
  activeAttempt: NonNullable<CurrentAttempt> | null
) {
  if (activeAttempt) {
    return true;
  }

  return (
    attempt?.section?.status === "completed" ||
    attempt?.section?.status === "expired"
  );
}

/** Builds the href for either a visible public section or an internal set entry. */
function getEntrySectionHref({
  entrySection,
  route,
}: {
  entrySection: SetEntrySection;
  route: TryoutSetRoute;
}) {
  if (entrySection.publicPath) {
    return getTryoutPublicPathHref(entrySection.publicPath);
  }

  return getTryoutHref(route);
}
