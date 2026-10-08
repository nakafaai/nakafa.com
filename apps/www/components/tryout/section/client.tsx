"use client";

import { QueryResult, useQuery } from "@confect/react";
import refs from "@repo/backend/confect/_generated/refs";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useLocale } from "next-intl";
import { type ReactNode, Suspense, use, useState } from "react";
import { useConvexAuth } from "@/components/providers/convex";
import { ShellLock } from "@/components/sidebar/lock";
import type { TryoutRuntimeContent } from "@/components/tryout/content/model";
import { TryoutContentRefresh } from "@/components/tryout/content/refresh.client";
import {
  getTryoutAttemptHref,
  getTryoutHref,
} from "@/components/tryout/route/path";
import { TryoutRuntime } from "@/components/tryout/runtime/client";
import { useTryoutClock } from "@/components/tryout/runtime/clock";
import { TryoutRuntimeControls } from "@/components/tryout/runtime/controls.client";
import {
  getActiveTryoutAttempt,
  getTryoutRuntimeState,
  isTryoutStateLive,
  type TryoutRuntimeState,
} from "@/components/tryout/runtime/state";
import type { TryoutSectionRuntime } from "@/components/tryout/runtime/types";
import {
  type TryoutStartDestination,
  TryoutSummaryAction,
} from "@/components/tryout/section/action.client";
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
    startHref: string | null;
  } | null;
  children: ReactNode;
  content: Promise<TryoutRuntimeContent> | null;
  page: TryoutSectionPage;
  route: TryoutSectionRoute;
  setHref: string;
}

interface TryoutSectionBodyProps {
  children: ReactNode;
  content: Promise<TryoutRuntimeContent> | null;
  runtimeState: TryoutRuntimeState<TryoutSectionRuntime>;
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
    refs.public.tryouts.queries.runtime.getSectionAttemptState,
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

  if (QueryResult.isFailure(liveState)) {
    throw liveState.error;
  }

  let state: SectionState = binding.initialState;
  if (QueryResult.isSuccess(liveState)) {
    state = liveState.value;
  }
  if (terminalState !== undefined) {
    state = terminalState;
  }
  return (
    <ResolvedTryoutSectionPage
      binding={binding}
      content={content}
      page={page}
      route={route}
      setHref={setHref}
      state={state}
    >
      {children}
    </ResolvedTryoutSectionPage>
  );
}

/**
 * Renders the stable section UI from one cohesive reactive state. A page
 * rendered for a running attempt locks the app shell until the learner leaves
 * it, even once the attempt ends here, so the shell never changes under a page.
 */
function ResolvedTryoutSectionPage({
  binding,
  children,
  content,
  page,
  route,
  setHref,
  state,
}: TryoutSectionPageClientProps & {
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
  const isRunning =
    runtimeState.kind === "active" || runtimeState.kind === "pending";
  return (
    <TryoutPage>
      {lock}
      <TryoutSectionHeader
        actionAttempt={actionAttempt}
        activeAttempt={activeAttempt}
        binding={binding}
        page={page}
        route={route}
        runtimeState={runtimeState}
        sectionStatus={sectionStatus}
        setHref={setHref}
      />
      <TryoutPageBody>
        {!isRunning && (
          <TryoutSectionSummary
            value={{
              score: actionAttempt?.section?.score ?? null,
              section: page.section,
              sectionStatus,
            }}
          />
        )}
        <TryoutSectionBody content={content} runtimeState={runtimeState}>
          {children}
        </TryoutSectionBody>
      </TryoutPageBody>
    </TryoutPage>
  );
}

/** Switches the section header between runtime controls and the start or return action. */
function TryoutSectionHeader({
  activeAttempt,
  actionAttempt,
  binding,
  page,
  route,
  runtimeState,
  sectionStatus,
  setHref,
}: Pick<
  TryoutSectionPageClientProps,
  "binding" | "page" | "route" | "setHref"
> & {
  activeAttempt: NonNullable<SectionState>["attempt"] | null;
  actionAttempt: NonNullable<SectionState>["attempt"] | null;
  runtimeState: TryoutRuntimeState<TryoutSectionRuntime>;
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
  const isRunning =
    runtimeState.kind === "active" || runtimeState.kind === "pending";
  return isRunning ? (
    <TryoutRuntimeControls
      title={page.section.title}
      value={{
        expired: runtimeState.kind === "pending",
        runtime: runtimeState.runtime,
        returnHref: attemptSetHref,
      }}
    />
  ) : (
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

/** Keeps signed content loading separate from stable page controls. */
function TryoutSectionBody({
  children,
  content,
  runtimeState,
}: TryoutSectionBodyProps) {
  if (runtimeState.kind === "none") {
    return null;
  }
  if (runtimeState.kind === "review") {
    return (
      <Suspense fallback={null}>
        {children ?? <TryoutContentRefresh />}
      </Suspense>
    );
  }
  return (
    <Suspense fallback={null}>
      <TryoutSectionRuntimeContent
        content={content}
        runtimeState={runtimeState}
      />
    </Suspense>
  );
}

/** Resolves signed content only inside the section runtime region. */
function TryoutSectionRuntimeContent({
  content,
  runtimeState,
}: Pick<TryoutSectionBodyProps, "content" | "runtimeState">) {
  if (!content) {
    return <TryoutContentRefresh />;
  }

  const loadedContent = use(content);
  if (loadedContent.questions.length === 0) {
    return <TryoutContentRefresh />;
  }
  if (runtimeState.kind === "none") {
    return null;
  }
  if (runtimeState.kind === "review") {
    return <TryoutContentRefresh />;
  }
  return (
    <TryoutRuntime
      value={{
        expired: runtimeState.kind !== "active",
        questions: loadedContent.questions,
        runtime: runtimeState.runtime,
      }}
    />
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
