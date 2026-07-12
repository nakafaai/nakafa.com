"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import { getTryoutHref } from "@/components/tryout/route/path";
import { TryoutSummaryAction } from "@/components/tryout/section/action.client";
import type { TryoutFinishedSectionStatus } from "@/components/tryout/section/finished";
import { TryoutSectionSummary } from "@/components/tryout/section/summary";

type SectionPageQuery = typeof api.tryouts.queries.catalog.getSectionPage;
type SectionPage = NonNullable<FunctionReturnType<SectionPageQuery>>;
type CurrentAttempt = FunctionReturnType<
  typeof api.tryouts.queries.attempt.getCurrent
>;

interface TryoutSectionRoute {
  country: string;
  exam: string;
  section: string;
  set: string;
  track: string;
}

/** Public visible-section summary contract. */
export interface TryoutVisibleSummaryValue {
  activeAttempt: NonNullable<CurrentAttempt> | null;
  attempt?: CurrentAttempt;
  locale: Locale;
  page: SectionPage;
  route: TryoutSectionRoute;
  sectionStatus: TryoutFinishedSectionStatus | null;
}

/** Renders the pre-runtime summary for a public visible section route. */
export function TryoutVisibleSummary({
  value,
}: {
  value: TryoutVisibleSummaryValue;
}) {
  const { route } = value;
  const returnHref = getTryoutHref({
    country: route.country,
    exam: route.exam,
    set: route.set,
    track: route.track,
  });
  const sectionHref = getTryoutHref(route);

  return (
    <TryoutSectionSummary
      section={value.page.section}
      sectionStatus={value.sectionStatus}
    >
      <TryoutSummaryAction
        value={{
          activeAttempt: value.activeAttempt,
          attempt: value.attempt,
          completedAction: "return",
          locale: value.locale,
          returnHref,
          section: value.page.section,
          sectionFinished: value.sectionStatus !== null,
          sectionHref,
          set: value.page.set,
        }}
      />
    </TryoutSectionSummary>
  );
}
