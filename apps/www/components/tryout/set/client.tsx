"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { type Preloaded, usePreloadedQuery, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { TryoutContentRefresh } from "@/components/tryout/content/refresh.client";
import {
  getTryoutAttemptHref,
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
  attemptId?: Id<"tryoutAttempts">;
  content: TryoutSetContent;
  page: SetPage;
  preloadedState?: Preloaded<SetStateQuery>;
  route: TryoutSetRoute;
}

type SetStateQuery = typeof api.tryouts.queries.runtime.getSetState;
type SetState = FunctionReturnType<SetStateQuery>;

/** Renders one realtime try-out set page from Convex. */
export function TryoutSetPageClient({
  attemptId,
  content,
  page,
  preloadedState,
  route,
}: TryoutSetPageClientProps) {
  const stateArgs: FunctionArgs<SetStateQuery> = {
    ...(attemptId ? { attemptId } : {}),
    locale: route.locale,
    publicPath: page.set.publicPath,
  };

  if (preloadedState) {
    return (
      <PreloadedTryoutSetPage
        attemptId={attemptId}
        content={content}
        page={page}
        preloadedState={preloadedState}
        route={route}
      />
    );
  }

  return (
    <LiveTryoutSetPage
      attemptId={attemptId}
      content={content}
      page={page}
      route={route}
      stateArgs={stateArgs}
    />
  );
}

/** Hydrates server-fetched set state before its live subscription resolves. */
function PreloadedTryoutSetPage({
  preloadedState,
  ...props
}: TryoutSetPageClientProps & {
  preloadedState: Preloaded<SetStateQuery>;
}) {
  const state = usePreloadedQuery(preloadedState);
  return <ResolvedTryoutSetPage {...props} state={state} />;
}

/** Loads one live set state when the public route had no authenticated preload. */
function LiveTryoutSetPage({
  stateArgs,
  ...props
}: Omit<TryoutSetPageClientProps, "preloadedState"> & {
  stateArgs: FunctionArgs<SetStateQuery>;
}) {
  const state = useQuery(api.tryouts.queries.runtime.getSetState, stateArgs);
  if (state === undefined) {
    return null;
  }
  return <ResolvedTryoutSetPage {...props} state={state} />;
}

/** Renders one stable set view from its cohesive reactive state. */
function ResolvedTryoutSetPage({
  content,
  page,
  route,
  state,
}: Omit<TryoutSetPageClientProps, "preloadedState"> & {
  state: SetState;
}) {
  const currentAttempt = state?.attempt ?? null;
  const runtime = state?.runtime ?? null;
  const entrySection = page.entrySection;
  const isInternalEntry = entrySection?.visibility === "internal-entry";
  const now = useTryoutClock(currentAttempt?.status === "in-progress");
  const activeAttempt = getActiveTryoutAttempt(currentAttempt ?? null, now);

  const actionAttempt =
    currentAttempt?.status === "in-progress" && !activeAttempt
      ? null
      : currentAttempt;

  const resumeSectionKey = activeAttempt?.resumeSectionKey ?? null;
  const resumeSection =
    page.sections.find(
      (sectionItem) => sectionItem.sectionKey === resumeSectionKey
    ) ?? entrySection;
  let destination = resumeSection
    ? {
        href: getEntrySectionHref({
          entrySection: resumeSection,
          route,
        }),
        sectionKey: resumeSection.sectionKey,
      }
    : null;
  if (
    activeAttempt?.resumeSectionKey &&
    activeAttempt.resumeSectionPublicPath
  ) {
    destination = {
      href: getTryoutAttemptHref(
        activeAttempt.resumeSectionPublicPath,
        activeAttempt.attemptId
      ),
      sectionKey: activeAttempt.resumeSectionKey,
    };
  }
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
          runtime,
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
