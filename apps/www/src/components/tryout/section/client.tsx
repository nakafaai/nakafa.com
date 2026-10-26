import { QueryResult, useQuery } from "@confect/react";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { createContext, type ReactNode, Suspense, use, useState } from "react";
import { useLocale } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import type { PlayerMode } from "@/components/player/mode";
import { ShellLock } from "@/components/sidebar/lock";
import type { TryoutRunningContent } from "@/components/tryout/content/model";
import { TryoutContentRefresh } from "@/components/tryout/content/refresh";
import { TryoutContentContext } from "@/components/tryout/player/articles";
import { TryoutPlayer } from "@/components/tryout/player/client";
import {
  type TryoutFinish,
  useTryoutFinish,
} from "@/components/tryout/player/finish";
import {
  getTryoutPublicPath,
  type TryoutPageAddress,
} from "@/components/tryout/route/path";
import { useTryoutClock } from "@/components/tryout/runtime/clock";
import {
  getActiveTryoutAttempt,
  getTryoutRuntimeState,
  isTryoutRuntimeRunning,
  isTryoutStateLive,
  type TryoutRuntimeState,
} from "@/components/tryout/runtime/state";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";
import {
  type TryoutStartDestination,
  TryoutSummaryAction,
} from "@/components/tryout/section/action";
import { getTryoutFinishedSectionStatus } from "@/components/tryout/section/finished";
import { TryoutSectionPageHeader } from "@/components/tryout/section/header";
import type {
  TryoutSectionInitialState,
  TryoutSectionPage,
  TryoutSectionRoute,
} from "@/components/tryout/section/model";
import { TryoutSectionSummary } from "@/components/tryout/section/summary";
import { TryoutPage, TryoutPageBody } from "@/components/tryout/shell/header";

type SectionState = TryoutSectionInitialState | null;

interface TryoutSectionPageClientProps {
  binding: {
    attemptId: Id<"tryoutAttempts">;
    initialState: TryoutSectionInitialState;
    /** The player view the server resolved from the address and the saved view. */
    mode: PlayerMode;
    startPath: string | null;
  } | null;
  children: ReactNode;
  /** The signed questions of a running section, rendered on the server. */
  content: TryoutRunningContent | null;
  page: TryoutSectionPage;
  route: TryoutSectionRoute;
  setPath: string;
}

/** The page the section client draws: its section page, its route, and the path of its set. Fixed for one page. */
const TryoutSectionPageContext = createContext<Pick<
  TryoutSectionPageClientProps,
  "page" | "route" | "setPath"
> | null>(null);

/** Reads the page of the surrounding section client. */
function useTryoutSectionPage() {
  const value = use(TryoutSectionPageContext);
  if (value === null) {
    throw new Error(
      "useTryoutSectionPage must be used within TryoutSectionPageClient"
    );
  }
  return value;
}

/** Renders one stable page with an active-only mutable subscription. */
export function TryoutSectionPageClient({
  binding,
  children,
  content,
  page,
  route,
  setPath,
}: TryoutSectionPageClientProps) {
  return (
    <TryoutContentContext value={{ content }}>
      <TryoutSectionPageContext value={{ page, route, setPath }}>
        {binding !== null && isTryoutStateLive(binding.initialState) ? (
          <LiveTryoutSectionPage
            binding={binding}
            key={`${binding.attemptId}:${page.section.sectionKey}`}
          >
            {children}
          </LiveTryoutSectionPage>
        ) : (
          <ResolvedTryoutSectionPage
            binding={binding}
            finish={null}
            state={binding?.initialState ?? null}
          >
            {children}
          </ResolvedTryoutSectionPage>
        )}
      </TryoutSectionPageContext>
    </TryoutContentContext>
  );
}

/** Owns one active subscription and skips it after a terminal update. */
function LiveTryoutSectionPage({
  binding,
  children,
}: {
  binding: NonNullable<TryoutSectionPageClientProps["binding"]>;
  children: ReactNode;
}) {
  const { page } = useTryoutSectionPage();
  const isLoading = useConvexAuth((auth) => auth.isLoading);
  const locale = useLocale();
  const [terminalState, setTerminalState] = useState<
    SectionState | undefined
  >();
  // An unauthenticated response during hydration is not a terminal attempt.
  const liveState = useQuery(
    tryouts.queries.runtime.getSectionAttemptState,
    !isLoading && terminalState === undefined
      ? {
          attemptId: binding.attemptId,
          sectionKey: page.section.sectionKey,
          locale,
        }
      : "skip"
  );

  if (
    terminalState === undefined &&
    QueryResult.isSuccess(liveState) &&
    !isTryoutStateLive(liveState.value)
  ) {
    setTerminalState(liveState.value);
  }

  let state: SectionState = binding.initialState;
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
    <ResolvedTryoutSectionPage
      binding={binding}
      finish={finish}
      state={finish.shown}
    >
      {children}
    </ResolvedTryoutSectionPage>
  );
}

/**
 * Renders the stable section UI from one cohesive reactive state. A page
 * rendered for a running attempt locks the app shell until the learner leaves
 * it, even once the attempt ends here, so the shell never changes under a page.
 * A running section is the player, and every other state is the section page.
 */
function ResolvedTryoutSectionPage({
  binding,
  children,
  finish,
  state,
}: Pick<TryoutSectionPageClientProps, "binding" | "children"> & {
  /** The finish of a live attempt; a page without a live attempt has none. */
  finish: TryoutFinish | null;
  state: SectionState;
}) {
  const { page } = useTryoutSectionPage();
  const attempt = state?.attempt ?? null;
  const runtime = state?.runtime ?? null;
  const now = useTryoutClock(
    attempt?.status === "in-progress" ||
      runtime?.section.status === "in-progress"
  );

  const currentAttempt = attempt;
  const locked = binding?.initialState.attempt.status === "in-progress";
  const activeAttempt = getActiveTryoutAttempt(currentAttempt, now);
  const actionAttempt =
    currentAttempt?.status === "in-progress" && !activeAttempt
      ? null
      : currentAttempt;
  const sectionAttempt = actionAttempt?.section ?? null;
  const runtimeState = getTryoutRuntimeState({ activeAttempt, now, runtime });
  const hasActiveSection = currentAttempt?.section?.status === "in-progress";
  if (hasActiveSection && runtimeState.kind === "none") {
    return locked ? <ShellLock /> : null;
  }

  const sectionStatus = getTryoutFinishedSectionStatus(sectionAttempt);
  if (finish && binding && isTryoutRuntimeRunning(runtimeState)) {
    return (
      <TryoutPage>
        {locked ? <ShellLock /> : null}
        <TryoutPlayer
          finish={finish}
          mode={binding.mode}
          state={runtimeState}
          title={page.section.title}
        />
      </TryoutPage>
    );
  }

  return (
    <TryoutPage>
      {locked ? <ShellLock /> : null}
      <TryoutSectionHeader
        actionAttempt={actionAttempt}
        activeAttempt={activeAttempt}
        binding={binding}
        sectionStatus={sectionStatus}
      />
      <TryoutPageBody>
        <TryoutSectionSummary
          value={{
            score: actionAttempt?.section?.score ?? null,
            section: page.section,
            sectionStatus,
          }}
        />
        <TryoutSectionReview runtimeState={runtimeState}>
          {children}
        </TryoutSectionReview>
      </TryoutPageBody>
    </TryoutPage>
  );
}

/** Renders the section heading with its start or return action. */
function TryoutSectionHeader({
  activeAttempt,
  actionAttempt,
  binding,
  sectionStatus,
}: Pick<TryoutSectionPageClientProps, "binding"> & {
  activeAttempt: NonNullable<SectionState>["attempt"] | null;
  actionAttempt: NonNullable<SectionState>["attempt"] | null;
  sectionStatus: ReturnType<typeof getTryoutFinishedSectionStatus>;
}) {
  const { page, route, setPath } = useTryoutSectionPage();
  const startDestination = getStartDestination(binding, route);
  const attemptSetAddress: TryoutPageAddress = binding
    ? { attemptId: binding.attemptId, publicPath: page.set.publicPath }
    : { publicPath: setPath };
  // While this page's attempt runs, its set stays bound to that attempt: the
  // public set would only lead back to it through a second page.
  const returnAddress: TryoutPageAddress =
    binding?.initialState.attempt.status === "in-progress"
      ? attemptSetAddress
      : { publicPath: setPath };
  const hasCurrentPath =
    !binding || binding.startPath === getTryoutPublicPath(route);
  return (
    <TryoutSectionPageHeader
      page={page}
      parents={hasCurrentPath ? "linked" : "unlinked"}
      setPath={returnAddress.publicPath}
    >
      <TryoutSummaryAction
        value={{
          activeAttempt,
          attempt: actionAttempt,
          completedAction: "return",
          locale: route.locale,
          returnAddress,
          section: page.section,
          sectionFinished: sectionStatus !== null,
          set: page.set,
          startDestination,
        }}
      />
    </TryoutSectionPageHeader>
  );
}

/** Renders the signed review of a finished section, and nothing for any other state. */
function TryoutSectionReview({
  children,
  runtimeState,
}: {
  children: ReactNode;
  runtimeState: TryoutRuntimeState<TryoutSectionRuntime>;
}) {
  if (runtimeState.kind !== "review") {
    return null;
  }
  return (
    <Suspense fallback={null}>{children ?? <TryoutContentRefresh />}</Suspense>
  );
}

/** Selects how a start action leaves a public or retained section route. */
function getStartDestination(
  binding: TryoutSectionPageClientProps["binding"],
  route: TryoutSectionRoute
): TryoutStartDestination | null {
  if (!binding) {
    return {
      address: { publicPath: getTryoutPublicPath(route) },
      successNavigation: "stay",
    };
  }

  if (!binding.startPath) {
    return null;
  }

  return {
    address: { publicPath: binding.startPath },
    successNavigation: "destination",
  };
}
