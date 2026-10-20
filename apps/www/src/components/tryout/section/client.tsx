import { QueryResult, useQuery } from "@confect/react";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { type ReactNode, Suspense, useState } from "react";
import { useLocale } from "use-intl";
import type { PlayerMode } from "@/components/player/mode";
import { useConvexAuth } from "@/components/providers/convex";
import { ShellLock } from "@/components/sidebar/lock";
import type { TryoutRunningContent } from "@/components/tryout/content/model";
import { TryoutContentRefresh } from "@/components/tryout/content/refresh";
import { TryoutPlayer } from "@/components/tryout/player/client";
import {
  type TryoutFinish,
  useTryoutFinish,
} from "@/components/tryout/player/finish";
import {
  getTryoutAttemptHref,
  getTryoutHref,
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
    startHref: string | null;
  } | null;
  children: ReactNode;
  /** The signed questions of a running section, rendered on the server. */
  content: TryoutRunningContent | null;
  page: TryoutSectionPage;
  route: TryoutSectionRoute;
  setHref: string;
}

/** Renders one stable page with an active-only mutable subscription. */
export function TryoutSectionPageClient({
  binding,
  children,
  content,
  page,
  route,
  setHref,
}: TryoutSectionPageClientProps) {
  if (!binding) {
    return (
      <ResolvedTryoutSectionPage
        binding={null}
        content={content}
        finish={null}
        page={page}
        route={route}
        setHref={setHref}
        state={null}
      >
        {children}
      </ResolvedTryoutSectionPage>
    );
  }

  if (!isTryoutStateLive(binding.initialState)) {
    return (
      <ResolvedTryoutSectionPage
        binding={binding}
        content={content}
        finish={null}
        page={page}
        route={route}
        setHref={setHref}
        state={binding.initialState}
      >
        {children}
      </ResolvedTryoutSectionPage>
    );
  }

  return (
    <LiveTryoutSectionPage
      binding={binding}
      content={content}
      key={`${binding.attemptId}:${page.section.sectionKey}`}
      page={page}
      route={route}
      setHref={setHref}
    >
      {children}
    </LiveTryoutSectionPage>
  );
}

/** Owns one active subscription and skips it after a terminal update. */
function LiveTryoutSectionPage({
  binding,
  children,
  content,
  page,
  route,
  setHref,
}: TryoutSectionPageClientProps & {
  binding: NonNullable<TryoutSectionPageClientProps["binding"]>;
}) {
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
    returnHref: getTryoutAttemptHref(page.set.publicPath, binding.attemptId),
    state,
  });

  if (QueryResult.isFailure(liveState)) {
    throw liveState.error;
  }

  return (
    <ResolvedTryoutSectionPage
      binding={binding}
      content={content}
      finish={finish}
      page={page}
      route={route}
      setHref={setHref}
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
  content,
  finish,
  page,
  route,
  setHref,
  state,
}: TryoutSectionPageClientProps & {
  /** The finish of a live attempt; a page without a live attempt has none. */
  finish: TryoutFinish | null;
  state: SectionState;
}) {
  const attempt = state?.attempt ?? null;
  const runtime = state?.runtime ?? null;
  const now = useTryoutClock(
    attempt?.status === "in-progress" ||
      runtime?.section.status === "in-progress"
  );

  const currentAttempt = attempt;
  const lock =
    binding?.initialState.attempt.status === "in-progress" ? (
      <ShellLock />
    ) : null;
  const activeAttempt = getActiveTryoutAttempt(currentAttempt, now);
  const actionAttempt =
    currentAttempt?.status === "in-progress" && !activeAttempt
      ? null
      : currentAttempt;
  const sectionAttempt = actionAttempt?.section ?? null;
  const runtimeState = getTryoutRuntimeState({ activeAttempt, now, runtime });
  const hasActiveSection = currentAttempt?.section?.status === "in-progress";
  if (hasActiveSection && runtimeState.kind === "none") {
    return lock;
  }

  const sectionStatus = getTryoutFinishedSectionStatus(sectionAttempt);
  if (finish && binding && isTryoutRuntimeRunning(runtimeState)) {
    return (
      <TryoutPage>
        {lock}
        <TryoutPlayer
          content={content}
          finish={finish}
          locked={runtimeState.kind === "pending"}
          mode={binding.mode}
          runtime={runtimeState.runtime}
          title={page.section.title}
        />
      </TryoutPage>
    );
  }

  return (
    <TryoutPage>
      {lock}
      <TryoutSectionHeader
        actionAttempt={actionAttempt}
        activeAttempt={activeAttempt}
        binding={binding}
        page={page}
        route={route}
        sectionStatus={sectionStatus}
        setHref={setHref}
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
  page,
  route,
  sectionStatus,
  setHref,
}: Pick<
  TryoutSectionPageClientProps,
  "binding" | "page" | "route" | "setHref"
> & {
  activeAttempt: NonNullable<SectionState>["attempt"] | null;
  actionAttempt: NonNullable<SectionState>["attempt"] | null;
  sectionStatus: ReturnType<typeof getTryoutFinishedSectionStatus>;
}) {
  const startDestination = getStartDestination(binding, route);
  const attemptSetHref = binding
    ? getTryoutAttemptHref(page.set.publicPath, binding.attemptId)
    : setHref;
  // While this page's attempt runs, its set stays bound to that attempt: the
  // public set would only lead back to it through a second page.
  const returnHref =
    binding?.initialState.attempt.status === "in-progress"
      ? attemptSetHref
      : setHref;
  const hasCurrentPath = !binding || binding.startHref === getTryoutHref(route);
  return (
    <TryoutSectionPageHeader
      action={
        <TryoutSummaryAction
          value={{
            activeAttempt,
            attempt: actionAttempt,
            completedAction: "return",
            locale: route.locale,
            returnHref,
            section: page.section,
            sectionFinished: sectionStatus !== null,
            set: page.set,
            startDestination,
          }}
        />
      }
      page={page}
      parents={hasCurrentPath ? "linked" : "unlinked"}
      setHref={returnHref}
    />
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
      href: getTryoutHref(route),
      successNavigation: "stay",
    };
  }

  if (!binding.startHref) {
    return null;
  }

  return {
    href: binding.startHref,
    successNavigation: "destination",
  };
}
