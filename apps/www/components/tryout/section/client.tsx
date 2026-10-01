"use client";

import { QueryResult, useQuery } from "@confect/react";
import refs from "@repo/backend/confect/_generated/refs";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useConvexAuth } from "convex/react";
import { type Locale, useLocale } from "next-intl";
import { type ReactNode, Suspense, useState } from "react";
import type { PlayerMode } from "@/components/player/mode";
import { AppShell } from "@/components/sidebar/shell";
import type { TryoutRuntimeContent } from "@/components/tryout/content/model";
import { TryoutContentRefresh } from "@/components/tryout/content/refresh.client";
import { TryoutPlayer } from "@/components/tryout/player/client";
import { useTryoutFinish } from "@/components/tryout/player/finish.client";
import type { TryoutPlayerInput } from "@/components/tryout/player/model";
import {
  getTryoutAttemptHref,
  getTryoutHref,
  getTryoutPublicPathHref,
} from "@/components/tryout/route/path";
import { useTryoutClock } from "@/components/tryout/runtime/clock";
import {
  getActiveTryoutAttempt,
  getTryoutRuntimeState,
  isTryoutRuntimeRunning,
  isTryoutStateLive,
} from "@/components/tryout/runtime/state";
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
  TryoutPage,
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
  /** Player view the server resolved from the URL and cookie. */
  mode: PlayerMode;
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
        player={null}
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
        player={null}
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

  let state: SectionState = binding.initialState;
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
    <ResolvedTryoutSectionPage
      articleNavigation={articleNavigation}
      binding={binding}
      content={content}
      page={page}
      player={{ finish, mode: binding.mode }}
      route={route}
      setHref={setHref}
      state={finish.shown}
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
  player,
  route,
  setHref,
  state,
}: TryoutSectionPageClientProps & {
  /** Player inputs of a live attempt; `null` for static pages. */
  player: TryoutPlayerInput | null;
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
  return (
    <AppShell
      articleNavigation={articleNavigation}
      locked={currentAttempt?.status === "in-progress"}
    >
      <TryoutPage>
        {player && isTryoutRuntimeRunning(runtimeState) ? (
          <TryoutPlayer
            backHref={getTryoutAttemptHref(
              page.set.publicPath,
              runtimeState.runtime.attemptId
            )}
            content={content}
            finish={player.finish}
            locked={runtimeState.kind === "pending"}
            mode={player.mode}
            runtime={runtimeState.runtime}
            title={page.section.title}
          />
        ) : (
          <>
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
              {runtimeState.kind === "review" ? (
                <Suspense fallback={null}>
                  {children ?? <TryoutContentRefresh />}
                </Suspense>
              ) : null}
            </TryoutPageBody>
          </>
        )}
      </TryoutPage>
    </AppShell>
  );
}

/** Renders the section header with its start or return action. */
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
  const hasCurrentPath = !binding || binding.startHref === getTryoutHref(route);
  return (
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
