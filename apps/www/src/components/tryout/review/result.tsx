import { ChampionIcon } from "@hugeicons/core-free-icons";
import type { TryoutScoreResult } from "@repo/backend/confect/tryouts/score";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr, HashSet, Number as Num, Option } from "effect";
import { use } from "react";
import { useTranslations } from "use-intl";
import { useStore } from "zustand";
import { PlayerReviewGrid } from "@/components/player/navigator/review";
import { usePlayer } from "@/components/player/provider";
import { splitTime } from "@/components/player/time";
import { PaneFact, PaneFacts } from "@/components/shared/pane";
import {
  type createExplainedStore,
  TryoutExplainedContext,
  TryoutReviewContext,
} from "@/components/tryout/review/context";
import { reviewCellsOf } from "@/components/tryout/review/model";

/** A duration as a clock reads it, such as 01:15:00. */
function readClock(seconds: number) {
  const { hours, minutes, seconds: rest } = splitTime(seconds);
  return Arr.join(
    Arr.map([hours, minutes, rest], (part) => String(part).padStart(2, "0")),
    ":"
  );
}

/** Reads the review around the caller (`TryoutReviewFrame`). */
export function useTryoutReview() {
  const review = use(TryoutReviewContext);
  if (review === null) {
    throw new Error("useTryoutReview must be used within TryoutReviewFrame.");
  }
  return review;
}

/** Reads one selected slice of the review's open explanations. */
export function useTryoutExplained<T>(
  selector: (
    state: ReturnType<ReturnType<typeof createExplainedStore>["getState"]>
  ) => T
) {
  const store = use(TryoutExplainedContext);
  if (store === null) {
    throw new Error(
      "useTryoutExplained must be used within TryoutReviewFrame."
    );
  }
  return useStore(store, selector);
}

/**
 * A finished attempt's numbers, two to a row: its score, its correct answers, and, where the page shows one
 * paper, the time it took and the time it had.
 */
export function TryoutResultFacts({
  limit,
  score,
  used,
}: {
  /** The paper's time limit, in seconds. */
  limit: Option.Option<number>;
  score: TryoutScoreResult;
  /** The time the paper took, in seconds. */
  used: Option.Option<number>;
}) {
  const t = useTranslations("Tryouts");

  return (
    <PaneFacts layout="grid">
      <PaneFact
        label={t(
          score.scoreStatus === "provisional"
            ? "score-label-estimated"
            : "score-label-standard"
        )}
      >
        {score.publishedScore}
      </PaneFact>
      <PaneFact label={t("correct-answers-label")}>
        {score.totalCorrect} / {score.totalQuestions}
      </PaneFact>
      {Option.match(used, {
        onNone: () => null,
        onSome: (seconds) => (
          <PaneFact label={t("time-used-label")}>{readClock(seconds)}</PaneFact>
        ),
      })}
      {Option.match(limit, {
        onNone: () => null,
        onSome: (seconds) => (
          <PaneFact label={t("time-limit-label")}>
            {readClock(seconds)}
          </PaneFact>
        ),
      })}
    </PaneFacts>
  );
}

/**
 * A finished paper's result in its review: its numbers, then its questions' numbers, each with its verdict.
 * The time it took counts from the section's start to its end, up to its limit.
 */
export function TryoutResult() {
  const { limit, runtime, score } = useTryoutReview();
  const used = Option.map(
    Option.fromNullOr(runtime.section.completedAt),
    (completedAt) => {
      const seconds = Math.floor(
        (completedAt - runtime.section.startedAt) / 1000
      );
      return Option.match(limit, {
        onNone: () => seconds,
        onSome: (bound) => Num.min(seconds, bound),
      });
    }
  );

  return (
    <div className="flex flex-col gap-6">
      <TryoutResultFacts limit={limit} score={score} used={used} />
      <PlayerReviewGrid questions={reviewCellsOf(runtime.questions)} />
    </div>
  );
}

/**
 * The result's footer: what the colors of the numbers say, and the explanation of the current question, which
 * it opens and closes; a question whose explanation waits for Pro opens its offer.
 */
export function TryoutResultFooter() {
  const t = useTranslations("Tryouts");
  const tPlayer = useTranslations("Player");
  const current = usePlayer((state) => state.current);
  const explained = useTryoutExplained(
    (state) => current !== null && HashSet.has(state.open, current)
  );
  const toggle = useTryoutExplained((state) => state.toggle);

  return (
    <>
      <p className="text-muted-foreground me-auto text-sm">
        {tPlayer("review-legend")}
      </p>
      <Button
        aria-pressed={explained}
        disabled={current === null}
        onClick={() => {
          if (current !== null) {
            toggle(current);
          }
        }}
        type="button"
        variant="outline"
      >
        {t("explanation")}
      </Button>
    </>
  );
}

/**
 * Opens a pane's sheet below the large breakpoint, where no pane stands, from the centre of a footer: the
 * pane's word and a count out of a total, such as a result's correct answers or a practice's checked
 * questions, with `name` saying both to a screen reader.
 */
export function TryoutPaneOpener({
  count,
  label,
  name,
  onOpen,
  total,
}: {
  count: number;
  /** The pane's one word, such as Result. */
  label: string;
  /** What the button does, in words, for a screen reader. */
  name: string;
  onOpen: () => void;
  total: number;
}) {
  return (
    <Button
      aria-haspopup="dialog"
      aria-keyshortcuts="G"
      aria-label={name}
      className="tabular-nums lg:hidden"
      onClick={onOpen}
      type="button"
      variant="outline"
    >
      <HugeIcons icon={ChampionIcon} />
      <span>
        {label}{" "}
        <span className="font-mono">
          {count}
          <span className="text-muted-foreground">/{total}</span>
        </span>
      </span>
    </Button>
  );
}

/** The review's result opener, in the player's footer, which opens the player's sheet. */
export function TryoutReviewOpener() {
  const t = useTranslations("Tryouts");
  const { score } = useTryoutReview();
  const open = usePlayer((state) => state.open);

  return (
    <TryoutPaneOpener
      count={score.totalCorrect}
      label={t("result-short")}
      name={t("result-open", {
        correct: score.totalCorrect,
        total: score.totalQuestions,
      })}
      onOpen={() => open("navigator")}
      total={score.totalQuestions}
    />
  );
}
