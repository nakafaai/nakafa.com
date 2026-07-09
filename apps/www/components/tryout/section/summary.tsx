import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  TryoutPartBody,
  TryoutPartCtas,
  TryoutPartLead,
  TryoutPartStat,
  TryoutPartStats,
  TryoutPartSummary,
} from "@/components/tryout/section/card";
import {
  TryoutMetricNumber,
  TryoutMetricTime,
} from "@/components/tryout/section/metrics";
import { TryoutStatus } from "@/components/tryout/shell/status";

/** Minimal section contract rendered by the shared summary surface. */
export interface TryoutSummarySection {
  questionCount: number;
  sectionKey: string;
  timeLimitSeconds: number;
}

/** Renders shared section metrics around a composed action. */
export function TryoutSectionSummary({
  children,
  section,
  sectionFinished,
}: {
  children: ReactNode;
  section: TryoutSummarySection;
  sectionFinished: boolean;
}) {
  const tTryouts = useTranslations("Tryouts");

  return (
    <TryoutPartSummary>
      <TryoutPartBody>
        <TryoutPartLead>
          {sectionFinished ? <TryoutStatus status="completed" /> : null}

          <TryoutPartStats>
            <TryoutPartStat label={tTryouts("part-questions-label")}>
              <TryoutMetricNumber value={section.questionCount} />
            </TryoutPartStat>

            <TryoutPartStat label={tTryouts("part-time-label")}>
              <TryoutMetricTime totalSeconds={section.timeLimitSeconds} />
            </TryoutPartStat>
          </TryoutPartStats>
        </TryoutPartLead>

        <TryoutPartCtas>{children}</TryoutPartCtas>
      </TryoutPartBody>
    </TryoutPartSummary>
  );
}
