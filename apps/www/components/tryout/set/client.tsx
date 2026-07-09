"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Preloaded } from "convex/react";
import { useConvexAuth, usePreloadedQuery, useQuery } from "convex/react";
import {
  getTryoutHref,
  getTryoutPublicPathHref,
} from "@/components/tryout/route/path";
import { useTryoutClock } from "@/components/tryout/runtime/clock";
import {
  getActiveTryoutAttempt,
  getTryoutRuntimeState,
} from "@/components/tryout/runtime/state";
import { TryoutSetEntry } from "@/components/tryout/set/entry";
import type {
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
  const activeAttempt = getActiveTryoutAttempt(currentAttempt ?? null, now);
  const shouldLoadRuntime =
    page !== null &&
    entrySection !== null &&
    isInternalEntry &&
    isAuthenticated &&
    !isLoading &&
    attempt !== undefined &&
    Boolean(currentAttempt?.section);
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

  if (shouldLoadRuntime && runtime === undefined) {
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
  const runtimeState = getTryoutRuntimeState({
    activeAttempt,
    now,
    runtime: isInternalEntry ? (runtime ?? null) : null,
  });
  const hasActiveEntrySection =
    isInternalEntry && currentAttempt?.section?.status === "in-progress";

  if (hasActiveEntrySection && runtimeState.kind === "none") {
    return null;
  }

  if (runtimeState.kind !== "none" && content.entryQuestions.length === 0) {
    return null;
  }

  const view: TryoutSetView = {
    actionAttempt,
    activeAttempt,
    entryHref,
    entrySection,
    page,
    route,
  };

  if (isInternalEntry && entrySection) {
    return (
      <TryoutSetEntry
        value={{
          ...view,
          content,
          entrySection,
          runtimeState,
        }}
      />
    );
  }

  return <TryoutSetOverview value={view} />;
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
