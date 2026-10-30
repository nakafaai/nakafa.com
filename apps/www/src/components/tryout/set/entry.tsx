import { type ReactNode, Suspense } from "react";
import type { PlayerMode } from "@/components/player/mode";
import { PlayerDigits } from "@/components/player/timer";
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
import {
  TryoutSectionSummary,
  TryoutTimeLimitStat,
} from "@/components/tryout/section/summary";
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
export function TryoutSetEntry({ children, value }: TryoutSetEntryProps) {
  const state = value.runtimeState;
  if (value.player && isTryoutRuntimeRunning(state)) {
    return (
      <TryoutPage>
        <TryoutPlayer
          finish={value.player.finish}
          mode={value.player.mode}
          state={state}
          title={value.page.set.title}
        />
      </TryoutPage>
    );
  }

  return (
    <TryoutPage>
      <TryoutSetPageHeader
        currentPath={value.currentPath}
        page={value.page}
        returnPath={value.returnPath}
      >
        <TryoutEntryAction value={value} />
      </TryoutSetPageHeader>
      <TryoutPageBody>
        <TryoutEntryResult value={value} />
        <TryoutEntryReview runtimeState={state}>{children}</TryoutEntryReview>
      </TryoutPageBody>
    </TryoutPage>
  );
}

/**
 * Renders the one card of a direct-entry set: the attempt's score beside the
 * time limit once it has one, and the catalog's facts (the number of questions
 * and the time) before that. The score already says how many questions there
 * were, so the facts never sit in a second card beside it. The server renders
 * whichever applies, so the card never swaps after the first paint.
 */
function TryoutEntryResult({ value }: { value: TryoutSetEntryProps["value"] }) {
  const attempt = value.actionAttempt;

  if (!attempt?.score) {
    return (
      <TryoutSectionSummary
        value={{
          score: null,
          section: value.entrySection,
          sectionStatus: null,
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
        publicPath: value.page.set.publicPath,
      }}
    >
      <TryoutTimeLimitStat>
        <PlayerDigits
          seconds={value.entrySection.timeLimitSeconds}
          size="metric"
        />
      </TryoutTimeLimitStat>
    </TryoutAttemptResults>
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
        returnAddress: { publicPath: value.returnPath },
        section: startEntrySection,
        sectionFinished,
        set: value.start.set,
        ...(startEntrySection.visibility === "internal-entry"
          ? { startAttemptSectionKey: startEntrySection.sectionKey }
          : {}),
        startDestination: {
          address: startDestination.address,
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
