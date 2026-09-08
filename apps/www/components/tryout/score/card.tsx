"use client";

import type { TryoutScoreResult } from "@repo/backend/convex/tryouts/score";
import type { TryoutStatus as TryoutStatusValue } from "@repo/backend/convex/tryouts/status";
import type { ReactNode } from "react";
import { TryoutScoreMetrics } from "@/components/tryout/score/metrics";
import { TryoutScoreStatus } from "@/components/tryout/score/status";
import { TryoutPartSummary } from "@/components/tryout/section/card";
import { TryoutStatus } from "@/components/tryout/status";

/** Renders one terminal attempt's persisted result and composed next action. */
export function TryoutScoreCard({
  children,
  value,
}: {
  children?: ReactNode;
  value: { score: TryoutScoreResult; status: TryoutStatusValue };
}) {
  return (
    <TryoutPartSummary>
      <div className="flex min-h-9 items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <TryoutScoreStatus score={value.score} />
          <TryoutStatus status={value.status} />
        </div>
        {children}
      </div>
      <TryoutScoreMetrics score={value.score} />
    </TryoutPartSummary>
  );
}
