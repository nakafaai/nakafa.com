import type { TryoutScoreResult } from "@repo/backend/convex/tryouts/schema";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { TryoutScoreMetrics } from "@/components/tryout/score/metrics";
import { TryoutScoreStatus } from "@/components/tryout/score/status";
import {
  TryoutPartBody,
  TryoutPartCtas,
  TryoutPartLead,
  TryoutPartStat,
  TryoutPartStats,
  TryoutPartSummary,
} from "@/components/tryout/section/card";
import type { TryoutFinishedSectionStatus } from "@/components/tryout/section/finished";
import {
  TryoutMetricNumber,
  TryoutMetricTime,
} from "@/components/tryout/section/metrics";
import { TryoutStatus } from "@/components/tryout/status";

/** Minimal section contract rendered by the shared summary surface. */
export interface TryoutSummarySection {
  questionCount: number;
  sectionKey: string;
  timeLimitSeconds: number;
}

/** Renders shared section metrics around a composed action. */
export function TryoutSectionSummary({
  children,
  value,
}: {
  children: ReactNode;
  value: {
    score: TryoutScoreResult | null;
    section: TryoutSummarySection;
    sectionStatus: TryoutFinishedSectionStatus | null;
  };
}) {
  const { score, section, sectionStatus } = value;

  return (
    <TryoutPartSummary>
      <TryoutPartBody>
        <TryoutPartLead>
          <TryoutSectionStatuses score={score} status={sectionStatus} />

          <TryoutSectionMetrics score={score} section={section} />
        </TryoutPartLead>

        <TryoutPartCtas>{children}</TryoutPartCtas>
      </TryoutPartBody>
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

      <TryoutPartStat label={tTryouts("part-time-label")}>
        <TryoutMetricTime totalSeconds={section.timeLimitSeconds} />
      </TryoutPartStat>
    </TryoutPartStats>
  );
}
