"use client";

import { QueryResult, useQuery } from "@confect/react";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Option } from "effect";
import { useLocale } from "next-intl";
import { type ReactNode, useState } from "react";
import { useConvexAuth } from "@/components/providers/convex";
import { ShellLock } from "@/components/sidebar/lock";
import type { TryoutRuntimeContent } from "@/components/tryout/content/model";
import { selectTryoutSetLinks } from "@/components/tryout/route/owner";
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
} from "@/components/tryout/set/model";
import {
  TryoutSetOverview,
  type TryoutSetOverviewProps,
} from "@/components/tryout/set/overview";

type SetState = TryoutSetInitialState | null;

interface TryoutSetPageClientProps {
  binding: {
    attemptId: Id<"tryoutAttempts">;
    initialState: TryoutSetInitialState;
    sectionRoutes: readonly SetPage["sections"][number][];
  } | null;
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
}: TryoutSetPageClientProps & {
  binding: NonNullable<TryoutSetPageClientProps["binding"]>;
}) {
  const isLoading = useConvexAuth((auth) => auth.isLoading);
  const locale = useLocale();
  const [terminalState, setTerminalState] = useState<SetState | undefined>();
  // An unauthenticated response during hydration is not a terminal attempt.
  const liveState = useQuery(
    tryouts.queries.runtime.getSetAttemptState,
    !isLoading && terminalState === undefined
      ? { attemptId: binding.attemptId, locale }
      : "skip"
  );

  if (
    terminalState === undefined &&
    QueryResult.isSuccess(liveState) &&
    !isTryoutStateLive(liveState.value)
  ) {
    setTerminalState(liveState.value);
  }

  if (QueryResult.isFailure(liveState)) {
    throw liveState.error;
  }

  let state: SetState = binding.initialState;
  if (QueryResult.isSuccess(liveState)) {
    state = liveState.value;
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

/**
 * Renders one stable set view from its exact mutable state. A page rendered
 * for a running attempt locks the app shell until the learner leaves it, even
 * once the attempt ends here, so the shell never changes under a page.
 */
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

  const startEntrySection = activeAttempt
    ? entrySection
    : (restartTarget?.entrySection ?? null);
  const links = selectTryoutSetLinks(restartTarget);
  const destination = getStartDestination({
    activeAttempt,
    page,
    startEntrySection,
    setHref: activeAttempt ? getTryoutHref(route) : links.currentHref,
  });
  const view: TryoutSetOverviewProps["value"] = {
    actionAttempt,
    activeAttempt,
    currentHref: links.currentHref,
    entrySection,
    page,
    returnHref: links.returnHref,
    route,
    sectionRoutes: binding?.sectionRoutes ?? page.sections,
    start: {
      destination,
      entrySection: startEntrySection,
      set: page.set,
    },
  };

  return (
    <>
      {binding?.initialState.attempt.status === "in-progress" ? (
        <ShellLock />
      ) : null}
      {isInternalEntry && entrySection ? (
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
      ) : (
        <TryoutSetOverview value={view} />
      )}
    </>
  );
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
    view: TryoutSetOverviewProps["value"];
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

/** Resolves the start or resume destination without mixing route policy with rendering. */
function getStartDestination({
  activeAttempt,
  page,
  startEntrySection,
  setHref,
}: {
  activeAttempt: TryoutSetOverviewProps["value"]["activeAttempt"];
  page: SetPage;
  startEntrySection: SetEntrySection | null;
  setHref: string;
}) {
  if (
    activeAttempt?.resumeSectionKey &&
    activeAttempt.resumeSectionPublicPath
  ) {
    return {
      href: getTryoutAttemptHref(
        activeAttempt.resumeSectionPublicPath,
        activeAttempt.attemptId
      ),
      sectionKey: activeAttempt.resumeSectionKey,
    };
  }
  const resumeSection = Option.getOrElse(
    Arr.findFirst(
      page.sections,
      (section) => section.sectionKey === activeAttempt?.resumeSectionKey
    ),
    () => page.entrySection
  );
  const section = activeAttempt ? resumeSection : startEntrySection;
  if (!section) {
    return null;
  }
  return {
    href: getEntrySectionHref({ entrySection: section, setHref }),
    sectionKey: section.sectionKey,
  };
}
