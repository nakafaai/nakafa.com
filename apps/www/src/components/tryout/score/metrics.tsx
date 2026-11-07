import type { TryoutScoreResult } from "@repo/backend/confect/tryouts/score";
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

/**
 * Renders score and correctness metrics. A score that is not settled yet says so in
 * its own label, so no badge has to explain the number.
 */
export function TryoutScoreMetrics({ score }: { score: TryoutScoreResult }) {
  const tTryouts = useTranslations("Tryouts");
  const scoreLabel = tTryouts(
    score.scoreStatus === "provisional"
      ? "score-label-estimated"
      : "score-label-standard"
  );

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
    </TryoutPartStats>
  );
}
