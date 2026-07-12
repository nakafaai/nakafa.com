"use client";

import type { TryoutScoreResult } from "@repo/backend/convex/tryouts/schema";
import { useTranslations } from "next-intl";
import {
  TryoutPartStat,
  TryoutPartStats,
} from "@/components/tryout/section/card";
import {
  TryoutMetricFraction,
  TryoutMetricNumber,
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
        <TryoutMetricFraction
          correct={score.totalCorrect}
          total={score.totalQuestions}
        />
      </TryoutPartStat>
    </TryoutPartStats>
  );
}
