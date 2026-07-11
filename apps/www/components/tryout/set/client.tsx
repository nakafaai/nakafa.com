"use client";

import type { Preloaded } from "convex/react";
import { usePreloadedQuery } from "convex/react";
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
  SectionRuntimeQuery,
  SetEntrySection,
  TryoutSetContent,
  TryoutSetPreloads,
  TryoutSetRoute,
  TryoutSetView,
} from "@/components/tryout/set/model";
import { TryoutSetOverview } from "@/components/tryout/set/overview";

interface TryoutSetPageClientProps {
  content: TryoutSetContent;
  preloaded: TryoutSetPreloads;
  route: TryoutSetRoute;
}

/** Renders one realtime try-out set page from Convex. */
export function TryoutSetPageClient({
  content,
  preloaded,
  route,
}: TryoutSetPageClientProps) {
  const page = usePreloadedQuery(preloaded.page);
  const currentAttempt = usePreloadedQuery(preloaded.attempt);
  const entrySection = page?.entrySection ?? null;
  const isInternalEntry = entrySection?.visibility === "internal-entry";
  const now = useTryoutClock(currentAttempt?.status === "in-progress");
  const activeAttempt = getActiveTryoutAttempt(currentAttempt ?? null, now);

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
  const setHref = getTryoutHref(route);
  const entryHref = resumeSection
    ? getEntrySectionHref({
        entrySection: resumeSection,
        route,
      })
    : setHref;
  const view: TryoutSetView = {
    actionAttempt,
    activeAttempt,
    entryHref,
    entrySection,
    page,
    route,
  };

  if (isInternalEntry && entrySection && preloaded.runtime) {
    return (
      <TryoutInternalSet
        preloaded={preloaded.runtime}
        value={{
          content,
          currentAttempt,
          entrySection,
          now,
          view,
        }}
      />
    );
  }

  return <TryoutSetOverview value={view} />;
}

/** Hydrates one direct-entry runtime from its authenticated server preload. */
function TryoutInternalSet({
  preloaded,
  value,
}: {
  preloaded: Preloaded<SectionRuntimeQuery>;
  value: {
    content: TryoutSetContent;
    currentAttempt: TryoutSetView["actionAttempt"];
    entrySection: SetEntrySection;
    now: number;
    view: TryoutSetView;
  };
}) {
  const runtime = usePreloadedQuery(preloaded);
  const runtimeState = getTryoutRuntimeState({
    activeAttempt: value.view.activeAttempt,
    now: value.now,
    runtime,
  });
  const hasActiveEntrySection =
    value.currentAttempt?.section?.status === "in-progress";

  if (hasActiveEntrySection && runtimeState.kind === "none") {
    return null;
  }

  if (
    runtimeState.kind !== "none" &&
    value.content.entryQuestions.length === 0
  ) {
    return null;
  }

  return (
    <TryoutSetEntry
      value={{
        ...value.view,
        content: value.content,
        entrySection: value.entrySection,
        runtimeState,
      }}
    />
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
