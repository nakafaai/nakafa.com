import { type ReactNode, Suspense } from "react";
import type { PlayerMode } from "@/components/player/mode";
import type { TryoutRunningContent } from "@/components/tryout/content/model";
import { TryoutContentRefresh } from "@/components/tryout/content/refresh";
import { TryoutPlayer } from "@/components/tryout/player/client";
import type { TryoutFinish } from "@/components/tryout/player/finish";
import {
  isTryoutRuntimeRunning,
  type TryoutRuntimeState,
} from "@/components/tryout/runtime/state";
import { TryoutAttemptResults } from "@/components/tryout/score/history";
import { TryoutSummaryAction } from "@/components/tryout/section/action";
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
  content: TryoutRunningContent | null;
  /** Render model for sets whose only section is the set entry itself. */
  value: TryoutSetOverviewProps["value"] & {
    entrySection: SetEntrySection;
    /** The finish and the view of a live attempt; a page without one has none. */
    player: { finish: TryoutFinish; mode: PlayerMode } | null;
    runtimeState: TryoutRuntimeState<LoadedRuntime>;
  };
}

/**
 * Renders a no-nested-section set as the directly startable section surface.
 * A running section is the player, and every other state is the set page.
 */
export function TryoutSetEntry({
  children,
  content,
  value,
}: TryoutSetEntryProps) {
  const state = value.runtimeState;
  if (value.player && isTryoutRuntimeRunning(state)) {
    return (
      <TryoutPage>
        <TryoutPlayer
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
      <TryoutSetPageHeader
        action={<TryoutEntryAction value={value} />}
        currentHref={value.currentHref}
        page={value.page}
        returnHref={value.returnHref}
      />
      <TryoutPageBody>
        <TryoutEntryResult value={value} />
        <TryoutEntryReview runtimeState={state}>{children}</TryoutEntryReview>
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
  if (isTryoutRuntimeRunning(value.runtimeState)) {
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

/** Renders the signed review of a finished direct-entry section, and nothing for any other state. */
function TryoutEntryReview({
  children,
  runtimeState,
}: {
  children: ReactNode;
  runtimeState: TryoutRuntimeState<LoadedRuntime>;
}) {
  if (runtimeState.kind !== "review") {
    return null;
  }
  return (
    <Suspense fallback={null}>{children ?? <TryoutContentRefresh />}</Suspense>
  );
}
