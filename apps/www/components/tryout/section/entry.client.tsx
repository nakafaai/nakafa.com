"use client";

import type { ReactNode } from "react";
import {
  TryoutSummaryAction,
  type TryoutSummaryActionValue,
} from "@/components/tryout/section/action.client";
import {
  TryoutSectionSummary,
  type TryoutSummarySection,
} from "@/components/tryout/section/summary";

/** Direct-entry section summary presentation contract. */
export interface TryoutEntrySummaryValue {
  section: TryoutSummarySection;
  sectionFinished: boolean;
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
  return (
    <TryoutSectionSummary
      section={value.section}
      sectionFinished={value.sectionFinished}
    >
      {children}
    </TryoutSectionSummary>
  );
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
