import type { TryoutScoreResult } from "@repo/backend/confect/tryouts/score";
import { Option, Schema } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { PlayerDigits } from "@/components/player/timer";
import { useLiveSession } from "@/components/providers/live";
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

/**
 * Whether the facts of a card wait for a learner's read. A static page's first paint is every
 * reader's, so they wait until the page holds its client too. A session that could not be read
 * answers nothing, so they then show.
 */
function useFactsWaiting(pending: boolean) {
  const hasClient = useLiveSession((state) => Option.isSome(state.client));
  const failed = useLiveSession((state) => state.hasError);
  return !failed && (pending || !hasClient);
}

/** Renders shared section metrics around a composed action. */
export function TryoutSectionSummary({
  value,
}: {
  value: {
    /** The learner read that decides these metrics has not answered yet. */
    pending: boolean;
    score: TryoutScoreResult | null;
    section: TryoutSummarySection;
  };
}) {
  const { pending, score, section } = value;

  return (
    <TryoutPartSummary>
      <TryoutSectionMetrics pending={pending} score={score} section={section} />
    </TryoutPartSummary>
  );
}

/** Chooses terminal score metrics or pre-start section facts explicitly. */
function TryoutSectionMetrics({
  pending,
  score,
  section,
}: {
  pending: boolean;
  score: TryoutScoreResult | null;
  section: TryoutSummarySection;
}) {
  const tTryouts = useTranslations("Tryouts");
  const waiting = useFactsWaiting(pending);

  if (score) {
    return <TryoutScoreMetrics score={score} />;
  }

  return (
    <TryoutPartStats waiting={waiting}>
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
function TryoutTimeLimitStat({ children }: { children: ReactNode }) {
  const tTryouts = useTranslations("Tryouts");

  return (
    <TryoutPartStat label={tTryouts("part-time-label")}>
      {children}
    </TryoutPartStat>
  );
}
