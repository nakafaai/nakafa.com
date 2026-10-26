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

/** Renders strategy-aware score and correctness metrics. */
export function TryoutScoreMetrics({ score }: { score: TryoutScoreResult }) {
  const tTryouts = useTranslations("Tryouts");
  const scoreLabel =
    score.scoringStrategy === "irt"
      ? tTryouts("score-label-irt")
      : tTryouts("score-label-standard");

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
