"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import type { TryoutSectionAttempt } from "@/components/tryout/runtime/types";
import {
  type TryoutStartDestination,
  TryoutSummaryAction,
} from "@/components/tryout/section/action.client";
import type { TryoutFinishedSectionStatus } from "@/components/tryout/section/finished";
import { TryoutSectionSummary } from "@/components/tryout/section/summary";

type SectionPageQuery = typeof api.tryouts.queries.catalog.getSectionPage;
type SectionPage = NonNullable<FunctionReturnType<SectionPageQuery>>;
type CurrentAttempt = TryoutSectionAttempt | null;

/** Public visible-section summary contract. */
export interface TryoutVisibleSummaryValue {
  activeAttempt: NonNullable<CurrentAttempt> | null;
  attempt?: CurrentAttempt;
  locale: Locale;
  page: SectionPage;
  returnHref: string;
  sectionStatus: TryoutFinishedSectionStatus | null;
  startDestination: TryoutStartDestination | null;
}

/** Renders the pre-runtime summary for a public visible section route. */
export function TryoutVisibleSummary({
  value,
}: {
  value: TryoutVisibleSummaryValue;
}) {
  return (
    <TryoutSectionSummary
      value={{
        score: value.attempt?.section?.score ?? null,
        section: value.page.section,
        sectionStatus: value.sectionStatus,
      }}
    >
      <TryoutSummaryAction
        value={{
          activeAttempt: value.activeAttempt,
          attempt: value.attempt,
          completedAction: "return",
          locale: value.locale,
          returnHref: value.returnHref,
          section: value.page.section,
          sectionFinished: value.sectionStatus !== null,
          set: value.page.set,
          startDestination: value.startDestination,
        }}
      />
    </TryoutSectionSummary>
  );
}
