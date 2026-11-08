import { Option } from "effect";
import type { ReactNode } from "react";
import type { PlayerMode } from "@/components/player/mode";
import { PlayerTimer } from "@/components/player/timer";
import { PlayerViewSwitch } from "@/components/player/view";
import type { TryoutFinish } from "@/components/tryout/player/finish";
import {
  TryoutPlayerOpening,
  TryoutRunningPlayer,
} from "@/components/tryout/player/opening";
import {
  TryoutFinishedPlace,
  TryoutReviewFrame,
} from "@/components/tryout/review/frame";
import { useTryoutStartPhase } from "@/components/tryout/runtime/start";
import {
  isTryoutRuntimeRunning,
  type TryoutRuntimeState,
} from "@/components/tryout/runtime/state";
import { TryoutAttemptPicker } from "@/components/tryout/score/history";
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
  /** Render model for sets whose only section is the set entry itself. */
  value: TryoutSetOverviewProps["value"] & {
    entrySection: SetEntrySection;
    /** The finish of a live attempt; a page without one has none. */
    finish: TryoutFinish | null;
    /** The view the browser resolved, for the player and the review. */
    mode: PlayerMode;
    runtimeState: TryoutRuntimeState<LoadedRuntime>;
  };
}

/**
 * Renders a no-nested-section set as the directly startable section surface.
 * A running section is the player, a section the learner's press is opening is
 * the player's frame until it runs, a finished one is its review in the same
 * player, and every other state is the set page.
 */
export function TryoutSetEntry({ children, value }: TryoutSetEntryProps) {
  const opening = useTryoutStartPhase() === "opening";
  const state = value.runtimeState;
  if (value.finish && isTryoutRuntimeRunning(state)) {
    return (
      <TryoutPage>
        <TryoutRunningPlayer
          finish={value.finish}
          mode={value.mode}
          state={state}
          title={value.page.set.title}
        />
      </TryoutPage>
    );
  }
  if (opening) {
    return (
      <TryoutPage>
        <TryoutPlayerOpening
          questionCount={value.entrySection.questionCount}
          title={value.page.set.title}
        >
          <PlayerTimer seconds={value.entrySection.timeLimitSeconds} />
        </TryoutPlayerOpening>
      </TryoutPage>
    );
  }

  const score = value.actionAttempt?.score ?? null;
  if (score && state.kind === "review") {
    return (
      <TryoutPage>
        <TryoutReviewFrame
          header={
            <TryoutEntryHeader value={value}>
              <PlayerViewSwitch />
            </TryoutEntryHeader>
          }
          limit={Option.some(value.entrySection.timeLimitSeconds)}
          mode={value.mode}
          runtime={state.runtime}
          score={score}
        >
          {children}
        </TryoutReviewFrame>
      </TryoutPage>
    );
  }

  return (
    <TryoutPage>
      <TryoutEntryHeader value={value} />
      <TryoutPageBody>
        <TryoutSectionSummary
          value={{
            pending: value.actionAttempt === undefined,
            score,
            section: value.entrySection,
          }}
        />
        <TryoutFinishedPlace pending={value.actionAttempt === undefined} />
      </TryoutPageBody>
    </TryoutPage>
  );
}

/**
 * The set's header: its path and title, the attempt picker, what the page adds, such as the view of a
 * review's questions, and the action.
 */
function TryoutEntryHeader({
  children,
  value,
}: {
  children?: ReactNode;
  value: TryoutSetEntryProps["value"];
}) {
  return (
    <TryoutSetPageHeader
      currentPath={value.currentPath}
      page={value.page}
      returnPath={value.returnPath}
    >
      <TryoutAttemptPicker
        attempt={value.actionAttempt}
        locale={value.route.locale}
        set={value.page.set}
      />
      {children}
      <TryoutEntryAction value={value} />
    </TryoutSetPageHeader>
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
        startDestination:
          startEntrySection.visibility === "internal-entry"
            ? { address: startDestination.address, successNavigation: "stay" }
            : {
                address: startDestination.address,
                sectionKey: startEntrySection.sectionKey,
                successNavigation: "destination",
              },
      }}
    />
  );
}
