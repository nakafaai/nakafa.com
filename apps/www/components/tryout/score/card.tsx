"use client";

import type {
  TryoutScoreResult,
  TryoutStatus as TryoutStatusValue,
} from "@repo/backend/convex/tryouts/schema";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { TryoutScoreMetrics } from "@/components/tryout/score/metrics";
import { TryoutScoreStatus } from "@/components/tryout/score/status";
import {
  TryoutPartBody,
  TryoutPartCtas,
  TryoutPartLead,
  TryoutPartSummary,
} from "@/components/tryout/section/card";
import { TryoutStatus } from "@/components/tryout/status";

/** Renders one terminal attempt's persisted result and composed next action. */
export function TryoutScoreCard({
  children,
  value,
}: {
  children?: ReactNode;
  value: { score: TryoutScoreResult; status: TryoutStatusValue };
}) {
  const tTryouts = useTranslations("Tryouts");

  return (
    <TryoutPartSummary>
      <div className="flex flex-wrap gap-2">
        <TryoutScoreStatus score={value.score} />
        <TryoutStatus status={value.status} />
      </div>

      <TryoutPartBody>
        <TryoutPartLead>
          <TryoutScoreMetrics score={value.score} />
        </TryoutPartLead>

        <TryoutScoreActions>{children}</TryoutScoreActions>
      </TryoutPartBody>

      <p className="text-muted-foreground text-sm">
        {tTryouts("score-card-review-hint")}
      </p>
    </TryoutPartSummary>
  );
}

/** Renders composed score-card actions only when a caller supplies them. */
function TryoutScoreActions({ children }: { children?: ReactNode }) {
  if (!children) {
    return null;
  }

  return <TryoutPartCtas>{children}</TryoutPartCtas>;
}
