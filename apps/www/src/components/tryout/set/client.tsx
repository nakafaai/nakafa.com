import { QueryResult, useQuery } from "@confect/react";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Option } from "effect";
import { type ReactNode, useState } from "react";
import { useLocale } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import type { PlayerMode } from "@/components/player/mode";
import { ShellLock } from "@/components/sidebar/lock";
import type { TryoutRunningContent } from "@/components/tryout/content/model";
import {
  type TryoutFinish,
  useTryoutFinish,
} from "@/components/tryout/player/finish";
import { selectTryoutSetLinks } from "@/components/tryout/route/owner";
import {
  getTryoutPublicPath,
  type TryoutPageAddress,
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
    /** The player view the server resolved from the address and the saved view. */
    mode: PlayerMode;
    sectionRoutes: readonly SetPage["sections"][number][];
  } | null;
  children: ReactNode;
  /** The signed questions of a running attempt, rendered on the server. */
  content: TryoutRunningContent | null;
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
        finish={null}
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
        finish={null}
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

  let state: SetState = binding.initialState;
  if (QueryResult.isSuccess(liveState)) {
    state = liveState.value;
  }
  if (terminalState !== undefined) {
    state = terminalState;
  }
  // The finish holds the running state, so it reads the state before any early exit.
  const finish = useTryoutFinish({
    returnAddress: {
      attemptId: binding.attemptId,
      publicPath: page.set.publicPath,
    },
    state,
  });

  if (QueryResult.isFailure(liveState)) {
    throw liveState.error;
  }

  return (
    <ResolvedTryoutSetPage
      binding={binding}
      content={content}
      finish={finish}
      page={page}
      restartTarget={restartTarget}
      route={route}
      state={finish.shown}
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
  finish,
  page,
  restartTarget,
  route,
  state,
}: TryoutSetPageClientProps & {
  /** The finish of a live attempt; a page without a live attempt has none. */
  finish: TryoutFinish | null;
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
  const links = selectTryoutSetLinks(Option.fromNullishOr(restartTarget));
  const destination = getStartDestination({
    activeAttempt,
    page,
    startEntrySection,
    setPath: activeAttempt ? getTryoutPublicPath(route) : links.currentPath,
  });
  const view: TryoutSetOverviewProps["value"] = {
    actionAttempt,
    activeAttempt,
    currentPath: links.currentPath,
    entrySection,
    page,
    returnPath: links.returnPath,
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
            player: finish && binding ? { finish, mode: binding.mode } : null,
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
    content: TryoutRunningContent | null;
    entrySection: SetEntrySection;
    now: number;
    player: { finish: TryoutFinish; mode: PlayerMode } | null;
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
        player: value.player,
        runtimeState,
      }}
    >
      {children}
    </TryoutSetEntry>
  );
}

/** Addresses either a visible public section or an internal set entry. */
function getEntrySectionAddress({
  entrySection,
  setPath,
}: {
  entrySection: SetEntrySection;
  setPath: string;
}): TryoutPageAddress {
  return { publicPath: entrySection.publicPath ?? setPath };
}

/** Resolves the start or resume destination without mixing route policy with rendering. */
function getStartDestination({
  activeAttempt,
  page,
  startEntrySection,
  setPath,
}: {
  activeAttempt: TryoutSetOverviewProps["value"]["activeAttempt"];
  page: SetPage;
  startEntrySection: SetEntrySection | null;
  setPath: string;
}) {
  if (
    activeAttempt?.resumeSectionKey &&
    activeAttempt.resumeSectionPublicPath
  ) {
    return {
      address: {
        attemptId: activeAttempt.attemptId,
        publicPath: activeAttempt.resumeSectionPublicPath,
      },
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
    address: getEntrySectionAddress({ entrySection: section, setPath }),
    sectionKey: section.sectionKey,
  };
}
