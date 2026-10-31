import type { TryoutScoreResult } from "@repo/backend/confect/tryouts/score";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import {
  TryoutPartStat,
  TryoutPartStats,
} from "@/components/tryout/section/card";
import {
  TryoutMetricFraction,
  TryoutMetricNumber,
  TryoutMetricSlash,
} from "@/components/tryout/section/metrics";

/** The name of a score: an estimate until it settles, and then its scale. */
function scoreLabelOf(
  score: Pick<TryoutScoreResult, "scoreStatus" | "scoringStrategy">
) {
  if (score.scoreStatus === "provisional") {
    return "score-label-estimated";
  }
  return score.scoringStrategy === "irt"
    ? "score-label-irt"
    : "score-label-standard";
}

/**
 * Renders strategy-aware score and correctness metrics, then the metrics the
 * caller composed after them, such as a set's time limit. A score that is not
 * settled yet says so in its own label, so no badge has to explain the number.
 */
export function TryoutScoreMetrics({
  children,
  score,
}: {
  children?: ReactNode;
  score: TryoutScoreResult;
}) {
  const tTryouts = useTranslations("Tryouts");
  const scoreLabel = tTryouts(scoreLabelOf(score));

  return (
    <TryoutPartStats>
      <TryoutPartStat label={scoreLabel}>
        <TryoutMetricNumber value={score.publishedScore} />
      </TryoutPartStat>

      <TryoutPartStat label={tTryouts("correct-answers-label")}>
        <TryoutMetricFraction>
          <TryoutMetricNumber value={score.totalCorrect} />
          <TryoutMetricSlash />
          <TryoutMetricNumber value={score.totalQuestions} />
        </TryoutMetricFraction>
      </TryoutPartStat>
      {children}
    </TryoutPartStats>
  );
}
