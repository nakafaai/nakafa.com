import type { TryoutScoreResult } from "@repo/backend/confect/tryouts/score";
import { Schema } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { PlayerDigits } from "@/components/player/timer";
import { TryoutScoreMetrics } from "@/components/tryout/score/metrics";
import {
  TryoutPartStat,
  TryoutPartStats,
  TryoutPartSummary,
} from "@/components/tryout/section/card";
import { TryoutMetricNumber } from "@/components/tryout/section/metrics";

const TryoutSummarySectionSchema = Schema.Struct({
  questionCount: Schema.Finite,
  sectionKey: Schema.String,
  timeLimitSeconds: Schema.Finite,
});

/** Minimal section contract rendered by the shared summary surface. */
export type TryoutSummarySection = typeof TryoutSummarySectionSchema.Type;

/** Renders shared section metrics around a composed action. */
export function TryoutSectionSummary({
  value,
}: {
  value: {
    score: TryoutScoreResult | null;
    section: TryoutSummarySection;
  };
}) {
  const { score, section } = value;

  return (
    <TryoutPartSummary>
      <TryoutSectionMetrics score={score} section={section} />
    </TryoutPartSummary>
  );
}

/** Chooses terminal score metrics or pre-start section facts explicitly. */
function TryoutSectionMetrics({
  score,
  section,
}: {
  score: TryoutScoreResult | null;
  section: TryoutSummarySection;
}) {
  const tTryouts = useTranslations("Tryouts");

  if (score) {
    return <TryoutScoreMetrics score={score} />;
  }

  return (
    <TryoutPartStats>
      <TryoutPartStat label={tTryouts("part-questions-label")}>
        <TryoutMetricNumber value={section.questionCount} />
      </TryoutPartStat>

      <TryoutTimeLimitStat>
        <PlayerDigits seconds={section.timeLimitSeconds} size="metric" />
      </TryoutTimeLimitStat>
    </TryoutPartStats>
  );
}

/**
 * Renders a section's time limit as one summary metric, before a start and
 * beside a score, with the digits the caller composed.
 */
export function TryoutTimeLimitStat({ children }: { children: ReactNode }) {
  const tTryouts = useTranslations("Tryouts");

  return (
    <TryoutPartStat label={tTryouts("part-time-label")}>
      {children}
    </TryoutPartStat>
  );
}
