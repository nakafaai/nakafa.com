import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { Option } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import type { PlayerMode } from "@/components/player/mode";
import { PlayerTimer, PlayerTimerCard } from "@/components/player/timer";
import type { TryoutFinish } from "@/components/tryout/player/finish";
import {
  TryoutPlayerOpening,
  TryoutRunningPlayer,
} from "@/components/tryout/player/opening";
import { TryoutPaperProvider } from "@/components/tryout/player/paper";
import { TryoutPracticeLink } from "@/components/tryout/practice/link";
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
import {
  TryoutSetPageHeader,
  useTryoutSetPath,
} from "@/components/tryout/set/header";
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
  const path = useTryoutSetPath({
    currentPath: value.currentPath,
    page: value.page,
    returnPath: value.returnPath,
  });

  return (
    // The set's one section is its paper, so the player's pane offers no sections.
    <TryoutPaperProvider
      current={value.entrySection.sectionKey}
      locked={isTryoutRuntimeRunning(value.runtimeState) || opening}
      parts={[]}
      path={path}
      title={value.page.set.title}
    >
      <TryoutSetEntryBody value={value}>{children}</TryoutSetEntryBody>
    </TryoutPaperProvider>
  );
}

/** The set's entry under its paper: the player, its opening frame, the review, or the set page. */
function TryoutSetEntryBody({ children, value }: TryoutSetEntryProps) {
  const opening = useTryoutStartPhase() === "opening";
  const state = value.runtimeState;
  if (value.finish && isTryoutRuntimeRunning(state)) {
    return (
      <TryoutPage>
        <TryoutRunningPlayer
          finish={value.finish}
          mode={value.mode}
          state={state}
        />
      </TryoutPage>
    );
  }
  if (opening) {
    return (
      <TryoutPage>
        <TryoutPlayerOpening
          card={
            <PlayerTimerCard seconds={value.entrySection.timeLimitSeconds} />
          }
          questionCount={value.entrySection.questionCount}
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
              <TryoutPracticeLink publicPath={value.currentPath} />
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
      <TryoutEntryHeader value={value}>
        <TryoutPracticeLink publicPath={value.currentPath} />
      </TryoutEntryHeader>
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
 * The set's header: its path and title, the attempt picker beside the practice in one group of outlined buttons,
 * and the try-out's action, so the
 * header holds the primary action and one group.
 */
function TryoutEntryHeader({
  children,
  value,
}: {
  /** The page's second control, beside the picker. */
  children: ReactNode;
  value: TryoutSetEntryProps["value"];
}) {
  const t = useTranslations("Tryouts");
  return (
    <TryoutSetPageHeader
      currentPath={value.currentPath}
      page={value.page}
      returnPath={value.returnPath}
    >
      <ButtonGroup aria-label={t("attempt-controls")}>
        <TryoutAttemptPicker
          attempt={value.actionAttempt}
          locale={value.route.locale}
          set={value.page.set}
        />
        {children}
      </ButtonGroup>
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
