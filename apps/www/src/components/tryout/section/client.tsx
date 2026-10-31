import { QueryResult, useQuery } from "@confect/react";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Option } from "effect";
import { createContext, type ReactNode, Suspense, use, useState } from "react";
import { useLocale } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import type { PlayerMode } from "@/components/player/mode";
import { PlayerTimer } from "@/components/player/timer";
import { ShellLock } from "@/components/sidebar/lock";
import type { TryoutBody } from "@/components/tryout/content/body";
import { TryoutContentContext } from "@/components/tryout/content/context";
import { TryoutPlayer } from "@/components/tryout/player/client";
import {
  type TryoutFinish,
  useTryoutFinish,
} from "@/components/tryout/player/finish";
import { TryoutPlayerOpening } from "@/components/tryout/player/opening";
import {
  getTryoutAttemptLock,
  getTryoutPublicPath,
  type TryoutPageAddress,
} from "@/components/tryout/route/path";
import { useTryoutClock } from "@/components/tryout/runtime/clock";
import {
  TryoutStartProvider,
  useTryoutStartPhase,
} from "@/components/tryout/runtime/start";
import {
  getActiveTryoutAttempt,
  getTryoutRuntimeState,
  isTryoutRuntimeRunning,
  isTryoutStateLive,
  selectActionAttempt,
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
import { useLastValue } from "@/lib/data/kept";

type SectionState = TryoutSectionInitialState | null;

interface TryoutSectionPageClientProps {
  binding: {
    attemptId: Id<"tryoutAttempts">;
    initialState: TryoutSectionInitialState;
    /** The player view resolved in the browser from the address and the saved view. */
    mode: PlayerMode;
    startPath: string | null;
  } | null;
  children: ReactNode;
  /** The decoded question bodies of the attempt: the running section's, or a finished one's for its review. */
  content: readonly TryoutBody[] | null;
  page: TryoutSectionPage;
  /** The learner's attempt is still being read, so the action waits for it and takes no press. */
  pending: boolean;
  route: TryoutSectionRoute;
  setPath: string;
}

/** The page the section client draws: its section page, whether the learner read is pending, its route, and the path of its set. */
const TryoutSectionPageContext = createContext<Pick<
  TryoutSectionPageClientProps,
  "page" | "pending" | "route" | "setPath"
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
  pending,
  route,
  setPath,
}: TryoutSectionPageClientProps) {
  return (
    <TryoutContentContext value={{ bodies: content }}>
      <TryoutSectionPageContext value={{ page, pending, route, setPath }}>
        <TryoutStartProvider>
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
        </TryoutStartProvider>
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
  let state: SectionState = Option.getOrElse(live, () => binding.initialState);
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
 * A running section is the player, a section the learner's press is opening is
 * the player's frame until it runs, and every other state is the section page.
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
  const { page, pending } = useTryoutSectionPage();
  const opening = useTryoutStartPhase() === "opening";
  const attempt = state?.attempt ?? null;
  const runtime = state?.runtime ?? null;
  const now = useTryoutClock(
    attempt?.status === "in-progress" ||
      runtime?.section.status === "in-progress"
  );

  const currentAttempt = attempt;
  const activeAttempt = getActiveTryoutAttempt(currentAttempt, now);
  const actionAttempt = selectActionAttempt({
    activeAttempt,
    currentAttempt,
    pending,
  });
  const sectionAttempt = actionAttempt?.section ?? null;
  const runtimeState = getTryoutRuntimeState({ activeAttempt, now, runtime });
  const hasActiveSection = currentAttempt?.section?.status === "in-progress";
  if (hasActiveSection && runtimeState.kind === "none") {
    return <SectionLock binding={binding} />;
  }

  const sectionStatus = getTryoutFinishedSectionStatus(sectionAttempt);
  if (finish && binding && isTryoutRuntimeRunning(runtimeState)) {
    return (
      <TryoutPage>
        <SectionLock binding={binding} />
        <TryoutPlayer
          finish={finish}
          mode={binding.mode}
          state={runtimeState}
          title={page.section.title}
        />
      </TryoutPage>
    );
  }
  if (opening) {
    return (
      <TryoutPage>
        <SectionLock binding={binding} />
        <TryoutPlayerOpening
          questionCount={page.section.questionCount}
          title={page.section.title}
        >
          <PlayerTimer seconds={page.section.timeLimitSeconds} />
        </TryoutPlayerOpening>
      </TryoutPage>
    );
  }

  return (
    <TryoutPage>
      <SectionLock binding={binding} />
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

/**
 * Locks the app shell while the attempt this page is bound to runs, or while the learner's press opens
 * a section here, so the page takes the whole screen from the press on.
 */
function SectionLock({
  binding,
}: Pick<TryoutSectionPageClientProps, "binding">) {
  const opening = useTryoutStartPhase() === "opening";
  if (binding?.initialState.attempt.status === "in-progress") {
    return (
      <ShellLock
        remember={getTryoutAttemptLock(
          binding.attemptId,
          binding.initialState.attempt.expiresAt
        )}
      />
    );
  }
  return opening ? <ShellLock /> : null;
}

/** Renders the section heading with its start or return action. */
function TryoutSectionHeader({
  activeAttempt,
  actionAttempt,
  binding,
  sectionStatus,
}: Pick<TryoutSectionPageClientProps, "binding"> & {
  activeAttempt: NonNullable<SectionState>["attempt"] | null;
  /** The attempt the action reads; none while the learner read is pending. */
  actionAttempt: NonNullable<SectionState>["attempt"] | null | undefined;
  sectionStatus: ReturnType<typeof getTryoutFinishedSectionStatus>;
}) {
  const { page, route, setPath } = useTryoutSectionPage();
  const startDestination = getStartDestination(
    binding,
    route,
    page.section.sectionKey
  );
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
          // An action without an attempt is one whose learner read is still pending.
          ...(actionAttempt === undefined ? {} : { attempt: actionAttempt }),
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
  return <Suspense fallback={null}>{children}</Suspense>;
}

/** Selects how a start action leaves a public or retained section route: it lands on this section. */
function getStartDestination(
  binding: TryoutSectionPageClientProps["binding"],
  route: TryoutSectionRoute,
  sectionKey: string
): TryoutStartDestination | null {
  if (!binding) {
    return {
      address: { publicPath: getTryoutPublicPath(route) },
      sectionKey,
      successNavigation: "stay",
    };
  }

  if (!binding.startPath) {
    return null;
  }

  return {
    address: { publicPath: binding.startPath },
    sectionKey,
    successNavigation: "destination",
  };
}
