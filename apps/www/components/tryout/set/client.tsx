"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { TryoutContentRefresh } from "@/components/tryout/content/refresh.client";
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
  LoadedRuntime,
  SetEntrySection,
  SetPage,
  TryoutSetContent,
  TryoutSetRoute,
  TryoutSetView,
} from "@/components/tryout/set/model";
import { TryoutSetOverview } from "@/components/tryout/set/overview";

interface TryoutSetPageClientProps {
  content: TryoutSetContent;
  page: SetPage;
  route: TryoutSetRoute;
}

/** Renders one realtime try-out set page from Convex. */
export function TryoutSetPageClient({
  content,
  page,
  route,
}: TryoutSetPageClientProps) {
  const currentAttempt = useQuery(
    api.tryouts.queries.attempt.getCurrentByPublicPath,
    {
      locale: route.locale,
      publicPath: page.set.publicPath,
    }
  );
  const entrySection = page.entrySection;
  const isInternalEntry = entrySection?.visibility === "internal-entry";
  const shouldLoadRuntime =
    isInternalEntry && currentAttempt !== undefined && currentAttempt !== null;
  const runtime = useQuery(
    api.tryouts.queries.runtime.getSection,
    shouldLoadRuntime && entrySection
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
  const now = useTryoutClock(currentAttempt?.status === "in-progress");
  const activeAttempt = getActiveTryoutAttempt(currentAttempt ?? null, now);

  if (currentAttempt === undefined) {
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
  const destination = resumeSection
    ? {
        href: getEntrySectionHref({
          entrySection: resumeSection,
          route,
        }),
        sectionKey: resumeSection.sectionKey,
      }
    : null;
  const view: TryoutSetView = {
    actionAttempt,
    activeAttempt,
    destination,
    entrySection,
    page,
    route,
  };

  if (isInternalEntry && entrySection) {
    return (
      <TryoutInternalSet
        value={{
          content,
          entrySection,
          now,
          runtime: runtime ?? null,
          view,
        }}
      />
    );
  }

  return <TryoutSetOverview value={view} />;
}

/** Renders one direct-entry runtime from its reactive authenticated query. */
function TryoutInternalSet({
  value,
}: {
  value: {
    content: TryoutSetContent;
    entrySection: SetEntrySection;
    now: number;
    runtime: LoadedRuntime | null;
    view: TryoutSetView;
  };
}) {
  const runtimeState = getTryoutRuntimeState({
    activeAttempt: value.view.activeAttempt,
    now: value.now,
    runtime: value.runtime,
  });

  if (
    runtimeState.kind !== "none" &&
    value.content.entryQuestions.length === 0
  ) {
    return <TryoutContentRefresh />;
  }

  if (
    runtimeState.kind === "review" &&
    value.content.entryAnswers.length === 0
  ) {
    return <TryoutContentRefresh />;
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
