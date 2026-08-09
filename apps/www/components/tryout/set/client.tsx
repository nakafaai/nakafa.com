"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
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
  isTryoutStateLive,
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

type SetStateQuery = typeof api.tryouts.queries.runtime.getSetAttemptState;
type SetState = FunctionReturnType<SetStateQuery>;

interface TryoutSetPageBinding {
  attemptId: Id<"tryoutAttempts">;
  initialState: NonNullable<SetState>;
  sectionRoutes: readonly SetPage["sections"][number][];
}

interface TryoutSetPageClientProps {
  binding: TryoutSetPageBinding | null;
  content: TryoutSetContent;
  page: SetPage;
  route: TryoutSetRoute;
  startPage: SetPage;
}

/** Renders one stable page with an active-only mutable subscription. */
export function TryoutSetPageClient({
  binding,
  content,
  page,
  route,
  startPage,
}: TryoutSetPageClientProps) {
  if (!binding) {
    return (
      <ResolvedTryoutSetPage
        binding={null}
        content={content}
        page={page}
        route={route}
        startPage={startPage}
        state={null}
      />
    );
  }

  if (!isTryoutStateLive(binding.initialState)) {
    return (
      <ResolvedTryoutSetPage
        binding={binding}
        content={content}
        page={page}
        route={route}
        startPage={startPage}
        state={binding.initialState}
      />
    );
  }

  return (
    <LiveTryoutSetPage
      binding={binding}
      content={content}
      key={binding.attemptId}
      page={page}
      route={route}
      startPage={startPage}
    />
  );
}

/** Owns one active subscription and skips it after a terminal update. */
function LiveTryoutSetPage({
  binding,
  ...props
}: TryoutSetPageClientProps & { binding: TryoutSetPageBinding }) {
  const [terminalState, setTerminalState] = useState<SetState | undefined>();
  const liveState = useQuery(
    api.tryouts.queries.runtime.getSetAttemptState,
    terminalState === undefined ? { attemptId: binding.attemptId } : "skip"
  );

  if (
    terminalState === undefined &&
    liveState !== undefined &&
    !isTryoutStateLive(liveState)
  ) {
    setTerminalState(liveState);
  }

  let state: SetState = binding.initialState;
  if (liveState !== undefined) {
    state = liveState;
  }
  if (terminalState !== undefined) {
    state = terminalState;
  }
  return <ResolvedTryoutSetPage {...props} binding={binding} state={state} />;
}

/** Renders one stable set view from its exact mutable state. */
function ResolvedTryoutSetPage({
  binding,
  content,
  page,
  route,
  state,
  startPage,
}: TryoutSetPageClientProps & { state: SetState }) {
  const currentAttempt = state?.attempt ?? null;
  const runtime = state?.runtime ?? null;
  const entrySection = page.entrySection;
  const isInternalEntry = entrySection?.visibility === "internal-entry";
  const now = useTryoutClock(currentAttempt?.status === "in-progress");
  const activeAttempt = getActiveTryoutAttempt(currentAttempt, now);

  const actionAttempt =
    currentAttempt?.status === "in-progress" && !activeAttempt
      ? null
      : currentAttempt;

  const resumeSectionKey = activeAttempt?.resumeSectionKey ?? null;
  const resumeSection =
    page.sections.find(
      (sectionItem) => sectionItem.sectionKey === resumeSectionKey
    ) ?? entrySection;
  const startEntrySection = startPage.entrySection;
  const destinationSection = activeAttempt ? resumeSection : startEntrySection;
  let destination = destinationSection
    ? {
        href: getEntrySectionHref({
          entrySection: destinationSection,
          route,
        }),
        sectionKey: destinationSection.sectionKey,
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
    entrySection,
    page,
    route,
    sectionRoutes: binding?.sectionRoutes ?? page.sections,
    start: {
      destination,
      entrySection: startEntrySection,
      set: startPage.set,
    },
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

/** Renders one direct-entry runtime from its exact authenticated query. */
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
