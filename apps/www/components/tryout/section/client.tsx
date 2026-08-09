"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type {
  TryoutAnswerContent,
  TryoutQuestionContent,
} from "@/components/tryout/content/model";
import { TryoutContentRefresh } from "@/components/tryout/content/refresh.client";
import { getTryoutHref } from "@/components/tryout/route/path";
import { TryoutRuntime } from "@/components/tryout/runtime/client";
import { useTryoutClock } from "@/components/tryout/runtime/clock";
import {
  getActiveTryoutAttempt,
  getTryoutRuntimeState,
  isTryoutStateLive,
  type TryoutRuntimeState,
} from "@/components/tryout/runtime/state";
import type {
  TryoutSectionAttempt,
  TryoutSectionRuntime,
} from "@/components/tryout/runtime/types";
import type { TryoutStartDestination } from "@/components/tryout/section/action.client";
import {
  getTryoutFinishedSectionDescription,
  getTryoutFinishedSectionStatus,
} from "@/components/tryout/section/finished";
import type { TryoutSectionPage } from "@/components/tryout/section/model";
import { TryoutVisibleSummary } from "@/components/tryout/section/summary.client";
import { TryoutPageHeader } from "@/components/tryout/shell/header";
import { TryoutMeta } from "@/components/tryout/shell/meta";

type SectionStateQuery =
  typeof api.tryouts.queries.runtime.getSectionAttemptState;
type SectionState = FunctionReturnType<SectionStateQuery>;

interface TryoutSectionPageClientProps {
  binding: TryoutSectionRouteBinding;
  content: TryoutSectionAssets;
  page: TryoutSectionPage;
  route: TryoutSectionRoute;
  setHref: string;
}

type TryoutSectionRouteBinding = {
  attemptId: Id<"tryoutAttempts">;
  initialState: NonNullable<SectionState>;
  startHref: string | null;
} | null;

interface TryoutSectionAssets {
  answers: readonly TryoutAnswerContent[];
  questions: readonly TryoutQuestionContent[];
}

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
  binding,
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
      />
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
      />
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
    />
  );
}

/** Owns one active subscription and skips it after a terminal update. */
function LiveTryoutSectionPage({
  binding,
  page,
  ...props
}: TryoutSectionPageClientProps & {
  binding: NonNullable<TryoutSectionRouteBinding>;
}) {
  const [terminalState, setTerminalState] = useState<
    SectionState | undefined
  >();
  const liveState = useQuery(
    api.tryouts.queries.runtime.getSectionAttemptState,
    terminalState === undefined
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
      {...props}
      binding={binding}
      page={page}
      state={state}
    />
  );
}

/** Renders the stable section UI from one cohesive reactive state. */
function ResolvedTryoutSectionPage({
  binding,
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
  const tCommon = useTranslations("Common");
  const tTryouts = useTranslations("Tryouts");
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

  if (runtimeState.kind !== "none" && content.questions.length === 0) {
    return <TryoutContentRefresh />;
  }

  const sectionStatus = getTryoutFinishedSectionStatus(sectionAttempt);
  const sectionFinished = sectionStatus !== null;
  const sectionTimeExpired = sectionStatus === "expired";
  const attemptFinished = Boolean(
    currentAttempt && currentAttempt.status !== "in-progress"
  );
  const startDestination = getStartDestination(binding, route);

  let status = tTryouts("part-head-needs-tryout");

  if (runtimeState.kind === "active") {
    status = tTryouts("part-head-in-progress");
  } else if (runtimeState.kind === "pending") {
    status = tTryouts("part-head-expiring");
  } else if (sectionFinished) {
    status = getTryoutFinishedSectionDescription({
      attemptFinished,
      sectionTimeExpired,
      tTryouts,
    });
  } else if (activeAttempt) {
    status = tTryouts("part-head-ready");
  } else if (currentAttempt) {
    status = tTryouts("part-head-ended");
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
      <div className="space-y-10">
        <TryoutPageHeader
          value={{
            icon: getMaterialIcon(page.section.sectionKey),
            link: {
              href: setHref,
              label: tCommon("back"),
            },
            meta: (
              <TryoutMeta
                items={[page.exam.title, page.track.title, page.set.title]}
              />
            ),
            status,
            title: page.section.title,
          }}
        />

        <div className="space-y-12">
          <TryoutSectionBody
            value={{
              actionAttempt,
              activeAttempt,
              content,
              page,
              route,
              runtimeState,
              sectionStatus,
              setHref,
              startDestination,
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** Composes active runtime, terminal summary, and review content explicitly. */
function TryoutSectionBody({
  value,
}: {
  value: {
    actionAttempt: TryoutSectionAttempt | null;
    activeAttempt: TryoutSectionAttempt | null;
    content: TryoutSectionAssets;
    page: TryoutSectionPage;
    route: TryoutSectionRoute;
    runtimeState: TryoutRuntimeState<TryoutSectionRuntime>;
    sectionStatus: ReturnType<typeof getTryoutFinishedSectionStatus>;
    setHref: string;
    startDestination: TryoutStartDestination | null;
  };
}) {
  if (value.runtimeState.kind === "active") {
    return (
      <TryoutRuntime
        value={{
          answers: value.content.answers,
          expired: false,
          questions: value.content.questions,
          returnHref: value.setHref,
          runtime: value.runtimeState.runtime,
        }}
      />
    );
  }

  if (value.runtimeState.kind === "pending") {
    return (
      <TryoutRuntime
        value={{
          answers: value.content.answers,
          expired: true,
          questions: value.content.questions,
          returnHref: value.setHref,
          runtime: value.runtimeState.runtime,
        }}
      />
    );
  }

  if (value.runtimeState.kind === "review") {
    if (value.content.answers.length === 0) {
      return <TryoutContentRefresh />;
    }

    return (
      <>
        <TryoutVisibleSummary
          value={{
            activeAttempt: value.activeAttempt,
            attempt: value.actionAttempt,
            locale: value.route.locale,
            page: value.page,
            returnHref: value.setHref,
            sectionStatus: value.sectionStatus,
            startDestination: value.startDestination,
          }}
        />
        <TryoutRuntime
          value={{
            answers: value.content.answers,
            expired: true,
            questions: value.content.questions,
            returnHref: value.setHref,
            runtime: value.runtimeState.runtime,
          }}
        />
      </>
    );
  }

  return (
    <TryoutVisibleSummary
      value={{
        activeAttempt: value.activeAttempt,
        attempt: value.actionAttempt,
        locale: value.route.locale,
        page: value.page,
        returnHref: value.setHref,
        sectionStatus: value.sectionStatus,
        startDestination: value.startDestination,
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
