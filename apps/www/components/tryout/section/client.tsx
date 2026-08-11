"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import { useQuery } from "convex/react";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { Suspense, use, useState } from "react";
import type { TryoutRuntimeContent } from "@/components/tryout/content/model";
import { TryoutContentRefresh } from "@/components/tryout/content/refresh.client";
import {
  getTryoutAttemptHref,
  getTryoutHref,
} from "@/components/tryout/route/path";
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
import type {
  TryoutSectionInitialState,
  TryoutSectionPage,
} from "@/components/tryout/section/model";
import { TryoutVisibleSummary } from "@/components/tryout/section/summary.client";
import { TryoutPageHeader } from "@/components/tryout/shell/header";
import { TryoutMeta } from "@/components/tryout/shell/meta";

type SectionState = TryoutSectionInitialState | null;

interface TryoutSectionPageClientProps {
  binding: TryoutSectionRouteBinding;
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
  actionAttempt: TryoutSectionAttempt | null;
  activeAttempt: TryoutSectionAttempt | null;
  content: Promise<TryoutRuntimeContent> | null;
  page: TryoutSectionPage;
  route: TryoutSectionRoute;
  runtimeReturnHref: string;
  runtimeState: TryoutRuntimeState<TryoutSectionRuntime>;
  sectionStatus: ReturnType<typeof getTryoutFinishedSectionStatus>;
  setHref: string;
  startDestination: TryoutStartDestination | null;
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

  const sectionStatus = getTryoutFinishedSectionStatus(sectionAttempt);
  const sectionFinished = sectionStatus !== null;
  const sectionTimeExpired = sectionStatus === "expired";
  const attemptFinished = Boolean(
    currentAttempt && currentAttempt.status !== "in-progress"
  );
  const startDestination = getStartDestination(binding, route);
  const runtimeReturnHref = binding
    ? getTryoutAttemptHref(page.set.publicPath, binding.attemptId)
    : setHref;

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
              runtimeReturnHref,
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
function TryoutSectionBody({ value }: { value: TryoutSectionBodyValue }) {
  if (value.runtimeState.kind === "active") {
    return (
      <Suspense fallback={null}>
        <TryoutSectionRuntimeContent value={value} />
      </Suspense>
    );
  }

  if (value.runtimeState.kind === "pending") {
    return (
      <Suspense fallback={null}>
        <TryoutSectionRuntimeContent value={value} />
      </Suspense>
    );
  }

  if (value.runtimeState.kind === "review") {
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
        <Suspense fallback={null}>
          <TryoutSectionRuntimeContent value={value} />
        </Suspense>
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

/** Resolves signed content only inside the section runtime region. */
function TryoutSectionRuntimeContent({
  value,
}: {
  value: TryoutSectionBodyValue;
}) {
  if (!value.content) {
    return <TryoutContentRefresh />;
  }

  const content = use(value.content);
  if (content.questions.length === 0) {
    return <TryoutContentRefresh />;
  }
  if (value.runtimeState.kind === "none") {
    return null;
  }
  if (value.runtimeState.kind === "review" && content.answers.length === 0) {
    return <TryoutContentRefresh />;
  }

  return (
    <TryoutRuntime
      value={{
        answers: content.answers,
        expired: value.runtimeState.kind !== "active",
        questions: content.questions,
        returnHref: value.runtimeReturnHref,
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
