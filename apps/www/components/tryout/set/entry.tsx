"use client";

import { type ReactNode, Suspense } from "react";
import type { TryoutRuntimeContent } from "@/components/tryout/content/model";
import { TryoutContentRefresh } from "@/components/tryout/content/refresh.client";
import { TryoutPlayer } from "@/components/tryout/player/client";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";
import { isTryoutRuntimeRunning } from "@/components/tryout/runtime/state";
import { TryoutAttemptResults } from "@/components/tryout/score/history.client";
import { TryoutSummaryAction } from "@/components/tryout/section/action.client";
import { getTryoutFinishedSectionStatus } from "@/components/tryout/section/finished";
import { TryoutSectionSummary } from "@/components/tryout/section/summary";
import type { TryoutInternalSetView } from "@/components/tryout/set/model";
import {
  TryoutPage,
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
  if (value.player && isTryoutRuntimeRunning(state)) {
    return (
      <TryoutPage>
        <TryoutPlayer
          backHref={value.returnHref}
          content={content}
          finish={value.player.finish}
          locked={state.kind === "pending"}
          mode={value.player.mode}
          runtime={state.runtime}
          title={value.page.set.title}
        />
      </TryoutPage>
    );
  }
  return (
    <TryoutPage>
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
      <TryoutPageBody>
        <TryoutEntryResult value={value} />
        {state.kind === "review" ? (
          <Suspense fallback={null}>
            {children ?? <TryoutContentRefresh />}
          </Suspense>
        ) : null}
      </TryoutPageBody>
    </TryoutPage>
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
