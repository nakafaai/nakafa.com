import type { TryoutScoreResult } from "@repo/backend/confect/tryouts/score";
import { Schema } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { PlayerDigits } from "@/components/player/timer";
import { TryoutScoreMetrics } from "@/components/tryout/score/metrics";
import { TryoutScoreStatus } from "@/components/tryout/score/status";
import {
  TryoutPartStat,
  TryoutPartStats,
  TryoutPartSummary,
} from "@/components/tryout/section/card";
import type { TryoutFinishedSectionStatus } from "@/components/tryout/section/finished";
import { TryoutMetricNumber } from "@/components/tryout/section/metrics";
import { TryoutStatus } from "@/components/tryout/status";

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
    sectionStatus: TryoutFinishedSectionStatus | null;
  };
}) {
  const { score, section, sectionStatus } = value;

  return (
    <TryoutPartSummary>
      <TryoutSectionStatuses score={score} status={sectionStatus} />

      <TryoutSectionMetrics score={score} section={section} />
    </TryoutPartSummary>
  );
}

/** Renders the section status row only when at least one status exists. */
function TryoutSectionStatuses({
  score,
  status,
}: {
  score: TryoutScoreResult | null;
  status: TryoutFinishedSectionStatus | null;
}) {
  if (score === null && status === null) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      <TryoutSectionScoreStatus score={score} />
      <TryoutSectionWorkflowStatus status={status} />
    </div>
  );
}

/** Renders a section's score status only after terminal scoring. */
function TryoutSectionScoreStatus({
  score,
}: {
  score: TryoutScoreResult | null;
}) {
  if (!score) {
    return null;
  }

  return <TryoutScoreStatus score={score} />;
}

/** Renders a section's terminal workflow status when it exists. */
function TryoutSectionWorkflowStatus({
  status,
}: {
  status: TryoutFinishedSectionStatus | null;
}) {
  if (!status) {
    return null;
  }

  return <TryoutStatus status={status} />;
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
