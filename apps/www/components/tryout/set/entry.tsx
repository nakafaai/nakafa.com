"use client";

import { type ReactNode, Suspense, use } from "react";
import type { TryoutRuntimeContent } from "@/components/tryout/content/model";
import { TryoutContentRefresh } from "@/components/tryout/content/refresh.client";
import {
  getTryoutAttemptHref,
  getTryoutPublicPathHref,
} from "@/components/tryout/route/path";
import { TryoutRuntime } from "@/components/tryout/runtime/client";
import { TryoutRuntimeControls } from "@/components/tryout/runtime/controls.client";
import { TryoutAttemptResults } from "@/components/tryout/score/history.client";
import { TryoutSummaryAction } from "@/components/tryout/section/action.client";
import { getTryoutFinishedSectionStatus } from "@/components/tryout/section/finished";
import { TryoutSectionSummary } from "@/components/tryout/section/summary";
import type { TryoutInternalSetView } from "@/components/tryout/set/model";
import {
  TryoutPageBody,
  TryoutPageHeader,
} from "@/components/tryout/shell/header";

/** Renders a no-nested-section set as the directly startable section surface. */
export function TryoutSetEntry({
  children,
  content,
  value,
}: {
  children: ReactNode;
  content: Promise<TryoutRuntimeContent> | null;
  value: TryoutInternalSetView;
}) {
  const state = value.runtimeState;
  const isRunning = state.kind === "active" || state.kind === "pending";
  return (
    <>
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
        <TryoutPageHeader
          action={<TryoutEntryAction value={value} />}
          items={[
            {
              href:
                value.currentHref ===
                getTryoutPublicPathHref(value.page.set.publicPath)
                  ? getTryoutPublicPathHref(value.page.exam.publicPath)
                  : undefined,
              label: value.page.exam.title,
            },
            { href: value.returnHref, label: value.page.track.title },
          ]}
          title={value.page.set.title}
        />
      )}
      <TryoutPageBody>
        {!isRunning && <TryoutEntryResult value={value} />}
        <TryoutEntryRuntime content={content} value={value}>
          {children}
        </TryoutEntryRuntime>
      </TryoutPageBody>
    </>
  );
}

/** Renders either the direct-entry facts or one terminal attempt result. */
function TryoutEntryResult({ value }: { value: TryoutInternalSetView }) {
  const sectionAttempt =
    value.runtimeState.kind === "none"
      ? null
      : value.runtimeState.runtime.section;
  const sectionStatus = getTryoutFinishedSectionStatus(sectionAttempt);
  const attempt = value.actionAttempt;

  if (!attempt?.score) {
    return (
      <TryoutSectionSummary
        value={{
          score: sectionAttempt?.score ?? null,
          section: value.entrySection,
          sectionStatus,
        }}
      />
    );
  }

  return (
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
  );
}

/** Renders a direct-entry action only outside active runtime states. */
function TryoutEntryAction({ value }: { value: TryoutInternalSetView }) {
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
        attempt: value.actionAttempt,
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
  value: TryoutInternalSetView;
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
  value: TryoutInternalSetView;
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

  return <TryoutEntryRuntimeResolved content={content} value={value} />;
}

/** Reads the signed content promise unconditionally to satisfy React `use` rules. */
function TryoutEntryRuntimeResolved({
  content,
  value,
}: {
  content: Promise<TryoutRuntimeContent>;
  value: TryoutInternalSetView;
}) {
  const resolvedContent = use(content);
  if (value.runtimeState.kind === "none") {
    return null;
  }
  if (value.runtimeState.kind === "review") {
    return <TryoutContentRefresh />;
  }
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
