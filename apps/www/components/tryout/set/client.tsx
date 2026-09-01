"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { type ReactNode, useState } from "react";
import type { TryoutRuntimeContent } from "@/components/tryout/content/model";
import { selectTryoutTrackReturnHref } from "@/components/tryout/route/owner";
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
  TryoutSetInitialState,
  TryoutSetRestartTarget,
  TryoutSetRoute,
  TryoutSetView,
} from "@/components/tryout/set/model";
import { TryoutSetOverview } from "@/components/tryout/set/overview";

type SetState = TryoutSetInitialState | null;

interface TryoutSetPageBinding {
  attemptId: Id<"tryoutAttempts">;
  initialState: TryoutSetInitialState;
  sectionRoutes: readonly SetPage["sections"][number][];
}

interface TryoutSetPageClientProps {
  binding: TryoutSetPageBinding | null;
  children: ReactNode;
  content: Promise<TryoutRuntimeContent> | null;
  page: SetPage;
  restartTarget: TryoutSetRestartTarget | null;
  route: TryoutSetRoute;
}

/** Renders one stable page with an active-only mutable subscription. */
export function TryoutSetPageClient({
  binding,
  children,
  content,
  page,
  restartTarget,
  route,
}: TryoutSetPageClientProps) {
  if (!binding) {
    return (
      <ResolvedTryoutSetPage
        binding={null}
        content={content}
        page={page}
        restartTarget={restartTarget}
        route={route}
        state={null}
      >
        {children}
      </ResolvedTryoutSetPage>
    );
  }

  if (!isTryoutStateLive(binding.initialState)) {
    return (
      <ResolvedTryoutSetPage
        binding={binding}
        content={content}
        page={page}
        restartTarget={restartTarget}
        route={route}
        state={binding.initialState}
      >
        {children}
      </ResolvedTryoutSetPage>
    );
  }

  return (
    <LiveTryoutSetPage
      binding={binding}
      content={content}
      key={binding.attemptId}
      page={page}
      restartTarget={restartTarget}
      route={route}
    >
      {children}
    </LiveTryoutSetPage>
  );
}

/** Owns one active subscription and skips it after a terminal update. */
function LiveTryoutSetPage({
  binding,
  children,
  content,
  page,
  restartTarget,
  route,
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
  return (
    <ResolvedTryoutSetPage
      binding={binding}
      content={content}
      page={page}
      restartTarget={restartTarget}
      route={route}
      state={state}
    >
      {children}
    </ResolvedTryoutSetPage>
  );
}

/** Renders one stable set view from its exact mutable state. */
function ResolvedTryoutSetPage({
  binding,
  children,
  content,
  page,
  restartTarget,
  route,
  state,
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
  const startEntrySection = activeAttempt
    ? entrySection
    : (restartTarget?.entrySection ?? null);
  const destinationSection = activeAttempt ? resumeSection : startEntrySection;
  const currentSetHref = restartTarget
    ? getTryoutPublicPathHref(restartTarget.setPublicPath)
    : getTryoutHref();
  const destinationSetHref = activeAttempt
    ? getTryoutHref(route)
    : currentSetHref;
  let destination = destinationSection
    ? {
        href: getEntrySectionHref({
          entrySection: destinationSection,
          setHref: destinationSetHref,
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
    currentHref: currentSetHref,
    entrySection,
    page,
    returnHref: selectTryoutTrackReturnHref(restartTarget),
    route,
    sectionRoutes: binding?.sectionRoutes ?? page.sections,
    start: {
      destination,
      entrySection: startEntrySection,
      set: page.set,
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
      >
        {children}
      </TryoutInternalSet>
    );
  }

  return <TryoutSetOverview value={view} />;
}

/** Renders one direct-entry runtime from its exact authenticated query. */
function TryoutInternalSet({
  children,
  value,
}: {
  children: ReactNode;
  value: {
    content: Promise<TryoutRuntimeContent> | null;
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

  return (
    <TryoutSetEntry
      content={value.content}
      value={{
        ...value.view,
        entrySection: value.entrySection,
        runtimeState,
      }}
    >
      {children}
    </TryoutSetEntry>
  );
}

/** Builds the href for either a visible public section or an internal set entry. */
function getEntrySectionHref({
  entrySection,
  setHref,
}: {
  entrySection: SetEntrySection;
  setHref: string;
}) {
  if (entrySection.publicPath) {
    return getTryoutPublicPathHref(entrySection.publicPath);
  }

  return setHref;
}
