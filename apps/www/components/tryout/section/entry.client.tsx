"use client";

import type { TryoutScoreResult } from "@repo/backend/convex/tryouts/schema";
import type { ReactNode } from "react";
import {
  TryoutSummaryAction,
  type TryoutSummaryActionValue,
} from "@/components/tryout/section/action.client";
import type { TryoutFinishedSectionStatus } from "@/components/tryout/section/finished";
import {
  TryoutSectionSummary,
  type TryoutSummarySection,
} from "@/components/tryout/section/summary";

/** Direct-entry section summary presentation contract. */
export interface TryoutEntrySummaryValue {
  score: TryoutScoreResult | null;
  section: TryoutSummarySection;
  sectionStatus: TryoutFinishedSectionStatus | null;
}

type TryoutEntrySummaryActionValue = Omit<
  TryoutSummaryActionValue,
  "completedAction" | "startAttemptSectionKey"
> & { startAttemptSectionKey: string };

/** Renders a direct-entry summary around a composed action. */
export function TryoutEntrySummary({
  children,
  value,
}: {
  children: ReactNode;
  value: TryoutEntrySummaryValue;
}) {
  return <TryoutSectionSummary value={value}>{children}</TryoutSectionSummary>;
}

/** Renders the start, resume, or restart action for a direct-entry summary. */
export function TryoutEntrySummaryAction({
  value,
}: {
  value: TryoutEntrySummaryActionValue;
}) {
  return (
    <TryoutSummaryAction
      value={{
        ...value,
        completedAction: "restart",
      }}
    />
  );
}
