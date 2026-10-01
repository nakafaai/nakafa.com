"use client";

import { QueryResult, useQuery } from "@confect/react";
import refs from "@repo/backend/confect/_generated/refs";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useConvexAuth } from "convex/react";
import { useLocale } from "next-intl";
import { type ReactNode, useState } from "react";
import type { PlayerMode } from "@/components/player/mode";
import { AppShell } from "@/components/sidebar/shell";
import type { TryoutRuntimeContent } from "@/components/tryout/content/model";
import { useTryoutFinish } from "@/components/tryout/player/finish.client";
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
  TryoutInternalSetView,
  TryoutSetInitialState,
  TryoutSetRestartTarget,
  TryoutSetRoute,
  TryoutSetView,
} from "@/components/tryout/set/model";
import { TryoutSetOverview } from "@/components/tryout/set/overview";
import type { ArticleNavigationItem } from "@/lib/content/article/navigation";

type SetState = TryoutSetInitialState | null;

interface TryoutSetPageBinding {
  attemptId: Id<"tryoutAttempts">;
  initialState: TryoutSetInitialState;
  /** Player view the server resolved from the URL and cookie. */
  mode: PlayerMode;
  sectionRoutes: readonly SetPage["sections"][number][];
}

interface TryoutSetPageClientProps {
  articleNavigation: readonly ArticleNavigationItem[];
  binding: TryoutSetPageBinding | null;
  children: ReactNode;
  content: Promise<TryoutRuntimeContent> | null;
  page: SetPage;
  restartTarget: TryoutSetRestartTarget | null;
  route: TryoutSetRoute;
}

/** Renders one stable page with an active-only mutable subscription. */
export function TryoutSetPageClient({
  articleNavigation,
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
        articleNavigation={articleNavigation}
        binding={null}
        content={content}
        page={page}
        player={null}
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
        articleNavigation={articleNavigation}
        binding={binding}
        content={content}
        page={page}
        player={null}
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
      articleNavigation={articleNavigation}
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
  articleNavigation,
  binding,
  children,
  content,
  page,
  restartTarget,
  route,
}: TryoutSetPageClientProps & { binding: TryoutSetPageBinding }) {
  const { isLoading } = useConvexAuth();
  const locale = useLocale();
  const [terminalState, setTerminalState] = useState<SetState | undefined>();
  // An unauthenticated response during hydration is not a terminal attempt.
  const liveState = useQuery(
    refs.public.tryouts.queries.runtime.getSetAttemptState,
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

  let state: SetState = binding.initialState;
  if (QueryResult.isSuccess(liveState)) {
    state = liveState.value;
  }
  if (terminalState !== undefined) {
    state = terminalState;
  }
  const finish = useTryoutFinish({
    returnHref: getTryoutAttemptHref(page.set.publicPath, binding.attemptId),
    state,
  });
  if (QueryResult.isFailure(liveState)) {
    throw liveState.error;
  }
  return (
    <ResolvedTryoutSetPage
      articleNavigation={articleNavigation}
      binding={binding}
      content={content}
      page={page}
      player={{ finish, mode: binding.mode }}
      restartTarget={restartTarget}
      route={route}
      state={finish.shown}
    >
      {children}
    </ResolvedTryoutSetPage>
  );
}

/** Renders one stable set view from its exact mutable state. */
function ResolvedTryoutSetPage({
  articleNavigation,
  binding,
  children,
  content,
  page,
  player,
  restartTarget,
  route,
  state,
}: TryoutSetPageClientProps & {
  /** Player inputs of a live attempt; `null` for static pages. */
  player: TryoutInternalSetView["player"];
  state: SetState;
}) {
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
  const currentSetHref = restartTarget
    ? getTryoutPublicPathHref(restartTarget.setPublicPath)
    : getTryoutHref();
  const destination = getStartDestination({
    activeAttempt,
    page,
    startEntrySection,
    setHref: activeAttempt ? getTryoutHref(route) : currentSetHref,
  });
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

  return (
    <AppShell
      articleNavigation={articleNavigation}
      locked={currentAttempt?.status === "in-progress"}
    >
      {isInternalEntry && entrySection ? (
        <TryoutInternalSet
          value={{
            content,
            entrySection,
            now,
            player,
            runtime,
            view,
          }}
        >
          {children}
        </TryoutInternalSet>
      ) : (
        <TryoutSetOverview value={view} />
      )}
    </AppShell>
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
    player: TryoutInternalSetView["player"];
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
        player: value.player,
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
  activeAttempt: TryoutSetView["activeAttempt"];
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
  const resumeSection =
    page.sections.find(
      (section) => section.sectionKey === activeAttempt?.resumeSectionKey
    ) ?? page.entrySection;
  const section = activeAttempt ? resumeSection : startEntrySection;
  if (!section) {
    return null;
  }
  return {
    href: getEntrySectionHref({ entrySection: section, setHref }),
    sectionKey: section.sectionKey,
  };
}
