"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useConvexAuth, useQuery } from "convex/react";
import type { Locale } from "next-intl";
import { type ReactNode, Suspense, use, useState } from "react";
import { AppShell } from "@/components/sidebar/app-shell";
import type { TryoutRuntimeContent } from "@/components/tryout/content/model";
import { TryoutContentRefresh } from "@/components/tryout/content/refresh.client";
import {
  getTryoutAttemptHref,
  getTryoutHref,
  getTryoutPublicPathHref,
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
import type {
  TryoutSectionInitialState,
  TryoutSectionPage,
} from "@/components/tryout/section/model";
import { TryoutSectionSummary } from "@/components/tryout/section/summary";
import {
  TryoutPageBody,
  TryoutPageHeader,
} from "@/components/tryout/shell/header";
import type { ArticleNavigationItem } from "@/lib/content/article/navigation";

type SectionState = TryoutSectionInitialState | null;

interface TryoutSectionPageClientProps {
  articleNavigation: readonly ArticleNavigationItem[];
  binding: TryoutSectionRouteBinding;
  children: ReactNode;
  content: Promise<TryoutRuntimeContent> | null;
  page: TryoutSectionPage;
  route: TryoutSectionRoute;
  setHref: string;
}

type TryoutSectionRouteBinding = {
  attemptId: Id<"tryoutAttempts">;
  initialState: TryoutSectionInitialState;
  startHref: string | null;
} | null;

interface TryoutSectionRoute {
  country: string;
  exam: string;
  locale: Locale;
  section: string;
  set: string;
  track: string;
}

interface TryoutSectionBodyValue {
  content: Promise<TryoutRuntimeContent> | null;
  runtimeState: TryoutRuntimeState<TryoutSectionRuntime>;
}

/** Renders one stable page with an active-only mutable subscription. */
export function TryoutSectionPageClient({
  articleNavigation,
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
        articleNavigation={articleNavigation}
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
        articleNavigation={articleNavigation}
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
      articleNavigation={articleNavigation}
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
  articleNavigation,
  binding,
  children,
  content,
  page,
  route,
  setHref,
}: TryoutSectionPageClientProps & {
  binding: NonNullable<TryoutSectionRouteBinding>;
}) {
  const { isLoading } = useConvexAuth();
  const [terminalState, setTerminalState] = useState<
    SectionState | undefined
  >();
  // An unauthenticated response during hydration is not a terminal attempt.
  const liveState = useQuery(
    api.tryouts.queries.runtime.getSectionAttemptState,
    !isLoading && terminalState === undefined
      ? {
          attemptId: binding.attemptId,
          sectionKey: page.section.sectionKey,
        }
      : "skip"
  );

  if (
    terminalState === undefined &&
    liveState !== undefined &&
    !isTryoutStateLive(liveState)
  ) {
    setTerminalState(liveState);
  }

  let state: SectionState = binding.initialState;
  if (liveState !== undefined) {
    state = liveState;
  }
  if (terminalState !== undefined) {
    state = terminalState;
  }
  return (
    <ResolvedTryoutSectionPage
      articleNavigation={articleNavigation}
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

/** Renders the stable section UI from one cohesive reactive state. */
function ResolvedTryoutSectionPage({
  articleNavigation,
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
  const activeAttempt = getActiveTryoutAttempt(currentAttempt, now);
  const actionAttempt =
    currentAttempt?.status === "in-progress" && !activeAttempt
      ? null
      : currentAttempt;
  const sectionAttempt = actionAttempt?.section ?? null;
  const runtimeState = getTryoutRuntimeState({ activeAttempt, now, runtime });
  const hasActiveSection = currentAttempt?.section?.status === "in-progress";
  if (hasActiveSection && runtimeState.kind === "none") {
    return null;
  }

  const sectionStatus = getTryoutFinishedSectionStatus(sectionAttempt);
  const isRunning =
    runtimeState.kind === "active" || runtimeState.kind === "pending";
  return (
    <AppShell
      articleNavigation={articleNavigation}
      locked={currentAttempt?.status === "in-progress"}
    >
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
        <TryoutSectionBody value={{ content, runtimeState }}>
          {children}
        </TryoutSectionBody>
      </TryoutPageBody>
    </AppShell>
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
  const runtimeReturnHref = binding
    ? getTryoutAttemptHref(page.set.publicPath, binding.attemptId)
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
        returnHref: runtimeReturnHref,
      }}
    />
  ) : (
    <TryoutPageHeader
      action={
        <TryoutSummaryAction
          value={{
            activeAttempt,
            attempt: actionAttempt,
            completedAction: "return",
            locale: route.locale,
            returnHref: setHref,
            section: page.section,
            sectionFinished: sectionStatus !== null,
            set: page.set,
            startDestination,
          }}
        />
      }
      items={[
        {
          href: hasCurrentPath
            ? getTryoutPublicPathHref(page.exam.publicPath)
            : undefined,
          label: page.exam.title,
        },
        {
          href: hasCurrentPath
            ? getTryoutPublicPathHref(page.track.publicPath)
            : undefined,
          label: page.track.title,
        },
        { href: setHref, label: page.set.title },
      ]}
      title={page.section.title}
    />
  );
}

/** Keeps signed content loading separate from stable page controls. */
function TryoutSectionBody({
  children,
  value,
}: {
  children: ReactNode;
  value: TryoutSectionBodyValue;
}) {
  if (value.runtimeState.kind === "none") {
    return null;
  }
  if (value.runtimeState.kind === "review") {
    return (
      <Suspense fallback={null}>
        {children ?? <TryoutContentRefresh />}
      </Suspense>
    );
  }
  return (
    <Suspense fallback={null}>
      <TryoutSectionRuntimeContent value={value} />
    </Suspense>
  );
}

/** Resolves signed content only inside the section runtime region. */
function TryoutSectionRuntimeContent({
  value,
}: {
  value: TryoutSectionBodyValue;
}) {
  if (!value.content) {
    return <TryoutContentRefresh />;
  }

  return (
    <TryoutSectionRuntimeResolved
      value={{ content: value.content, runtimeState: value.runtimeState }}
    />
  );
}

/** Reads the signed content promise unconditionally to satisfy React `use` rules. */
function TryoutSectionRuntimeResolved({
  value,
}: {
  value: {
    content: Promise<TryoutRuntimeContent>;
    runtimeState: TryoutSectionBodyValue["runtimeState"];
  };
}) {
  const content = use(value.content);
  if (content.questions.length === 0) {
    return <TryoutContentRefresh />;
  }
  if (value.runtimeState.kind === "none") {
    return null;
  }
  if (value.runtimeState.kind === "review") {
    return <TryoutContentRefresh />;
  }
  return (
    <TryoutRuntime
      value={{
        expired: value.runtimeState.kind !== "active",
        questions: content.questions,
        runtime: value.runtimeState.runtime,
      }}
    />
  );
}

/** Selects how a start action leaves a public or retained section route. */
function getStartDestination(
  binding: TryoutSectionRouteBinding,
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
