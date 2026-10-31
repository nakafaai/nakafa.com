import { QueryResult, useQuery } from "@confect/react";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Option } from "effect";
import { createContext, type ReactNode, use, useState } from "react";
import { useLocale } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import type { PlayerMode } from "@/components/player/mode";
import { ShellLock } from "@/components/sidebar/lock";
import type { TryoutBody } from "@/components/tryout/content/body";
import { TryoutContentContext } from "@/components/tryout/content/context";
import {
  type TryoutFinish,
  useTryoutFinish,
} from "@/components/tryout/player/finish";
import { selectTryoutSetLinks } from "@/components/tryout/route/owner";
import {
  getTryoutAttemptLock,
  getTryoutPublicPath,
  type TryoutPageAddress,
} from "@/components/tryout/route/path";
import { useTryoutClock } from "@/components/tryout/runtime/clock";
import {
  getActiveTryoutAttempt,
  getTryoutRuntimeState,
  isTryoutStateLive,
  selectActionAttempt,
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
import { useLastValue } from "@/lib/data/kept";

type SetState = TryoutSetInitialState | null;

interface TryoutSetPageClientProps {
  binding: {
    attemptId: Id<"tryoutAttempts">;
    initialState: TryoutSetInitialState;
    /** The player view resolved in the browser from the address and the saved view. */
    mode: PlayerMode;
    sectionRoutes: readonly SetPage["sections"][number][];
  } | null;
  children: ReactNode;
  /** The decoded question bodies of the attempt: the running section's, or a finished one's for its review. */
  content: readonly TryoutBody[] | null;
  page: SetPage;
  /** The learner's attempt is still being read, so the action waits for it and takes no press. */
  pending: boolean;
  restartTarget: TryoutSetRestartTarget | null;
  route: TryoutSetRoute;
}

/** The page the set client draws: its set page, whether the learner read is pending, the attempt to restart, and its route. */
const TryoutSetPageContext = createContext<Pick<
  TryoutSetPageClientProps,
  "page" | "pending" | "restartTarget" | "route"
> | null>(null);

/** Reads the page of the surrounding set client. */
function useTryoutSetPage() {
  const value = use(TryoutSetPageContext);
  if (value === null) {
    throw new Error("useTryoutSetPage must be used within TryoutSetPageClient");
  }
  return value;
}

/** Renders one stable page with an active-only mutable subscription. */
export function TryoutSetPageClient({
  binding,
  children,
  content,
  page,
  pending,
  restartTarget,
  route,
}: TryoutSetPageClientProps) {
  return (
    <TryoutContentContext value={{ bodies: content }}>
      <TryoutSetPageContext value={{ page, pending, restartTarget, route }}>
        {binding !== null && isTryoutStateLive(binding.initialState) ? (
          <LiveTryoutSetPage binding={binding} key={binding.attemptId}>
            {children}
          </LiveTryoutSetPage>
        ) : (
          <ResolvedTryoutSetPage
            binding={binding}
            finish={null}
            state={binding?.initialState ?? null}
          >
            {children}
          </ResolvedTryoutSetPage>
        )}
      </TryoutSetPageContext>
    </TryoutContentContext>
  );
}

/** Owns one active subscription and skips it after a terminal update. */
function LiveTryoutSetPage({
  binding,
  children,
}: {
  binding: NonNullable<TryoutSetPageClientProps["binding"]>;
  children: ReactNode;
}) {
  const { page } = useTryoutSetPage();
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

  const live = useLastValue(liveState);

  if (
    terminalState === undefined &&
    QueryResult.isSuccess(liveState) &&
    !isTryoutStateLive(liveState.value)
  ) {
    setTerminalState(liveState.value);
  }

  // A paused subscription, as during an auth reload, keeps the last live answer; the page's own state shows
  // only before the first one, so the timer and the answers never fall back to it.
  let state: SetState = Option.getOrElse(live, () => binding.initialState);
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
      finish={finish}
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
  finish,
  state,
}: Pick<TryoutSetPageClientProps, "binding" | "children"> & {
  /** The finish of a live attempt; a page without a live attempt has none. */
  finish: TryoutFinish | null;
  state: SetState;
}) {
  const { page, pending, restartTarget, route } = useTryoutSetPage();
  const currentAttempt = state?.attempt ?? null;
  const runtime = state?.runtime ?? null;
  const entrySection = page.entrySection;
  const isInternalEntry = entrySection?.visibility === "internal-entry";
  const now = useTryoutClock(currentAttempt?.status === "in-progress");
  const activeAttempt = getActiveTryoutAttempt(currentAttempt, now);

  const actionAttempt = selectActionAttempt({
    activeAttempt,
    currentAttempt,
    pending,
  });

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
    // An action without an attempt is one whose learner read is still pending.
    ...(actionAttempt === undefined ? {} : { actionAttempt }),
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
        <ShellLock
          remember={getTryoutAttemptLock(
            binding.attemptId,
            binding.initialState.attempt.expiresAt
          )}
        />
      ) : null}
      {isInternalEntry && entrySection ? (
        <TryoutInternalSet
          value={{
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
