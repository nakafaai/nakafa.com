import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { useNavigate } from "@tanstack/react-router";
import { Option } from "effect";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useTranslations } from "use-intl";
import type { PlayerMode } from "@/components/player/mode";
import { PlayerTimer, PlayerTimerCard } from "@/components/player/timer";
import type { TryoutSetPaneProps } from "@/components/tryout/pane/set";
import type { TryoutFinish } from "@/components/tryout/player/finish";
import {
  TryoutPlayerOpening,
  TryoutRunningPlayer,
} from "@/components/tryout/player/opening";
import { TryoutPaperProvider } from "@/components/tryout/player/paper";
import {
  TryoutFinishedPlace,
  TryoutReviewFrame,
} from "@/components/tryout/review/frame";
import { getTryoutPageTarget } from "@/components/tryout/route/path";
import { useTryoutStartPhase } from "@/components/tryout/runtime/start";
import type { TryoutRuntimeState } from "@/components/tryout/runtime/state";
import { isTryoutRuntimeRunning } from "@/components/tryout/runtime/state";
import { TryoutAttemptPicker } from "@/components/tryout/score/history";
import { TryoutSetAction } from "@/components/tryout/set/action";
import {
  TryoutSetPageHeader,
  useTryoutSetPath,
} from "@/components/tryout/set/header";
import type {
  LoadedRuntime,
  SetEntrySection,
} from "@/components/tryout/set/model";
import { TryoutPage } from "@/components/tryout/shell/header";

/** Props of the direct-entry set: its render model and its only section's runtime. */
interface TryoutSetEntryProps {
  children: ReactNode;
  /** Render model for sets whose only section is the set entry itself. */
  value: TryoutSetPaneProps["view"] & {
    entrySection: SetEntrySection;
    /** The finish of a live attempt; a page without one has none. */
    finish: TryoutFinish | null;
    /** The view the browser resolved, for the player and the review. */
    mode: PlayerMode;
    runtimeState: TryoutRuntimeState<LoadedRuntime>;
  };
}

/**
 * Renders a no-nested-section set's paper: the player while it runs, its opening frame while starting, or its
 * full review once it ends, waiting in the review's frame while either is on its way. An address that holds no
 * attempt of the learner returns straight to the set's pane, never drawing a standalone card-only page.
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

/** The set's entry under its paper: the player, its opening frame, the review, or return to its pane. */
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
          header={<TryoutEntryHeader value={value} />}
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

  // Only an address with no attempt of the learner and nothing to review returns to the pane. Any other state is
  // on its way to the player or the review, such as a finished attempt whose score is still being published, and
  // the set's pane sends a finished attempt back here, so returning then would bounce between the two.
  if (value.actionAttempt === null && state.kind === "none") {
    return <TryoutEntryRedirect publicPath={value.page.set.publicPath} />;
  }

  return (
    <TryoutPage>
      <TryoutEntryHeader value={value} />
      <TryoutFinishedPlace pending />
    </TryoutPage>
  );
}

/** Redirects a direct-entry paper URL that holds no attempt of the learner back to the set pane. */
function TryoutEntryRedirect({ publicPath }: { publicPath: string }) {
  const navigate = useNavigate();

  useEffect(() => {
    Option.map(getTryoutPageTarget({ publicPath }), (target) =>
      navigate({ ...target, replace: true })
    );
  }, [navigate, publicPath]);

  return null;
}

/**
 * The set's header: its path and title, the attempt picker in a group of outlined buttons, and the try-out's
 * action, whose dialog also opens the practice, so the header holds the primary action and one group. The view of a
 * review's questions lives in the pane's footer (`PlayerTools`).
 */
function TryoutEntryHeader({ value }: { value: TryoutSetEntryProps["value"] }) {
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

  return (
    <TryoutSetAction
      value={{
        activeAttempt: value.activeAttempt,
        currentPath: value.currentPath,
        ...(value.actionAttempt === undefined
          ? {}
          : { currentAttempt: value.actionAttempt }),
        destination: value.start.destination,
        entrySection: value.start.entrySection,
        locale: value.route.locale,
        set: value.start.set,
      }}
    />
  );
}
