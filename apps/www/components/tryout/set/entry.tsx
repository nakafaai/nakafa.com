"use client";

import { type ReactNode, Suspense, use } from "react";
import type { TryoutRuntimeContent } from "@/components/tryout/content/model";
import { TryoutContentRefresh } from "@/components/tryout/content/refresh.client";
import { getTryoutAttemptHref } from "@/components/tryout/route/path";
import { TryoutRuntime } from "@/components/tryout/runtime/client";
import { TryoutRuntimeControls } from "@/components/tryout/runtime/controls.client";
import type { TryoutRuntimeState } from "@/components/tryout/runtime/state";
import { TryoutAttemptResults } from "@/components/tryout/score/history.client";
import { TryoutSummaryAction } from "@/components/tryout/section/action.client";
import { getTryoutFinishedSectionStatus } from "@/components/tryout/section/finished";
import { TryoutSectionSummary } from "@/components/tryout/section/summary";
import { TryoutSetPageHeader } from "@/components/tryout/set/header";
import type {
  LoadedRuntime,
  SetEntrySection,
} from "@/components/tryout/set/model";
import type { TryoutSetOverviewProps } from "@/components/tryout/set/overview";
import { TryoutPage, TryoutPageBody } from "@/components/tryout/shell/header";

/** Props of the direct-entry set: its render model and its only section's runtime. */
interface TryoutSetEntryProps {
  children: ReactNode;
  content: Promise<TryoutRuntimeContent> | null;
  /** Render model for sets whose only section is the set entry itself. */
  value: TryoutSetOverviewProps["value"] & {
    entrySection: SetEntrySection;
    runtimeState: TryoutRuntimeState<LoadedRuntime>;
  };
}

/** Renders a no-nested-section set as the directly startable section surface. */
export function TryoutSetEntry({
  children,
  content,
  value,
}: TryoutSetEntryProps) {
  const state = value.runtimeState;
  const isRunning = state.kind === "active" || state.kind === "pending";
  return (
    <TryoutPage>
      {isRunning ? (
        <TryoutRuntimeControls
          title={value.page.set.title}
          value={{
            expired: state.kind === "pending",
            returnHref: getTryoutAttemptHref(
              value.page.set.publicPath,
              state.runtime.attemptId
            ),
            runtime: state.runtime,
          }}
        />
      ) : (
        <TryoutSetPageHeader
          action={<TryoutEntryAction value={value} />}
          currentHref={value.currentHref}
          page={value.page}
          returnHref={value.returnHref}
        />
      )}
      <TryoutPageBody>
        {!isRunning && <TryoutEntryResult value={value} />}
        <TryoutEntryRuntime content={content} value={value}>
          {children}
        </TryoutEntryRuntime>
      </TryoutPageBody>
    </TryoutPage>
  );
}

/**
 * Renders the direct-entry facts from the catalog, followed by the attempt's
 * score once it has one, so facts a pending page paints never move.
 */
function TryoutEntryResult({ value }: { value: TryoutSetEntryProps["value"] }) {
  const attempt = value.actionAttempt;

  return (
    <>
      <TryoutSectionSummary
        value={{
          score: null,
          section: value.entrySection,
          sectionStatus: null,
        }}
      />
      {attempt?.score ? (
        <TryoutAttemptResults
          value={{
            attempt: {
              attemptId: attempt.attemptId,
              attemptNumber: attempt.attemptNumber,
              score: attempt.score,
              startedAt: attempt.startedAt,
              status: attempt.status,
            },
            identity: {
              countryKey: value.page.set.countryKey,
              examKey: value.page.set.examKey,
              locale: value.route.locale,
              setKey: value.page.set.setKey,
              trackKey: value.page.set.trackKey,
            },
          }}
        />
      ) : null}
    </>
  );
}

/** Renders a direct-entry action only outside active runtime states. */
function TryoutEntryAction({ value }: { value: TryoutSetEntryProps["value"] }) {
  if (
    value.runtimeState.kind === "active" ||
    value.runtimeState.kind === "pending"
  ) {
    return null;
  }

  const sectionAttempt =
    value.runtimeState.kind === "none"
      ? null
      : value.runtimeState.runtime.section;
  const sectionFinished =
    getTryoutFinishedSectionStatus(sectionAttempt) !== null;
  const startEntrySection = value.start.entrySection;
  const startDestination = value.start.destination;
  if (!(startEntrySection && startDestination)) {
    return null;
  }

  return (
    <TryoutSummaryAction
      value={{
        completedAction: "restart",
        activeAttempt: value.activeAttempt,
        ...(value.actionAttempt === undefined
          ? {}
          : { attempt: value.actionAttempt }),
        locale: value.route.locale,
        returnHref: value.returnHref,
        section: startEntrySection,
        sectionFinished,
        set: value.start.set,
        ...(startEntrySection.visibility === "internal-entry"
          ? { startAttemptSectionKey: startEntrySection.sectionKey }
          : {}),
        startDestination: {
          href: startDestination.href,
          successNavigation:
            startEntrySection.visibility === "internal-entry"
              ? "stay"
              : "destination",
        },
      }}
    />
  );
}

/** Renders the direct-entry question runtime when Convex has one. */
function TryoutEntryRuntime({
  children,
  content,
  value,
}: {
  children: ReactNode;
  content: Promise<TryoutRuntimeContent> | null;
  value: TryoutSetEntryProps["value"];
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
      <TryoutEntryRuntimeContent content={content} value={value} />
    </Suspense>
  );
}

/** Resolves signed content only inside the direct-entry runtime region. */
function TryoutEntryRuntimeContent({
  content,
  value,
}: {
  content: Promise<TryoutRuntimeContent> | null;
  value: TryoutSetEntryProps["value"];
}) {
  if (value.runtimeState.kind === "none") {
    return null;
  }
  if (value.runtimeState.kind === "review") {
    return <TryoutContentRefresh />;
  }
  if (!content) {
    return <TryoutContentRefresh />;
  }

  const resolvedContent = use(content);
  if (resolvedContent.questions.length === 0) {
    return <TryoutContentRefresh />;
  }

  return (
    <TryoutRuntime
      value={{
        expired: value.runtimeState.kind !== "active",
        questions: resolvedContent.questions,
        runtime: value.runtimeState.runtime,
      }}
    />
  );
}
