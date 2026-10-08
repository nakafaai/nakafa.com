"use client";

import { TryoutCountdown } from "@/components/tryout/runtime/countdown";
import { TryoutAttemptResults } from "@/components/tryout/score/history.client";
import { TryoutSetAction } from "@/components/tryout/set/action.client";
import { TryoutSetPageHeader } from "@/components/tryout/set/header";
import type {
  CurrentAttempt,
  SetEntrySection,
  SetPage,
  TryoutSetDestination,
  TryoutSetRoute,
} from "@/components/tryout/set/model";
import { TryoutSectionRows } from "@/components/tryout/set/rows.client";
import { TryoutPage, TryoutPageBody } from "@/components/tryout/shell/header";

/** Props of the set overview: one cohesive render model shared by its surfaces. */
export interface TryoutSetOverviewProps {
  /** Cohesive render model shared by set overview surfaces. */
  value: {
    actionAttempt?: CurrentAttempt | null;
    activeAttempt: CurrentAttempt | null;
    currentHref: string;
    entrySection: SetEntrySection | null;
    page: SetPage;
    returnHref: string;
    route: TryoutSetRoute;
    sectionRoutes: readonly SetPage["sections"][number][];
    start: {
      destination: TryoutSetDestination | null;
      entrySection: SetEntrySection | null;
      set: SetPage["set"];
    };
  };
}

/**
 * Renders a set page that offers visible nested sections. The section list
 * comes first and the attempt's countdown or score follows it, so the list a
 * pending page paints from the catalog never moves when the attempt arrives.
 */
export function TryoutSetOverview({ value }: TryoutSetOverviewProps) {
  return (
    <TryoutPage>
      <TryoutSetPageHeader
        action={
          <TryoutSetAction
            value={{
              activeAttempt: value.activeAttempt,
              currentHref: value.currentHref,
              ...(value.actionAttempt === undefined
                ? {}
                : { currentAttempt: value.actionAttempt }),
              destination: value.start.destination,
              entrySection: value.start.entrySection,
              locale: value.route.locale,
              set: value.start.set,
            }}
          />
        }
        currentHref={value.currentHref}
        page={value.page}
        returnHref={value.returnHref}
      />
      <TryoutPageBody>
        <TryoutSectionRows
          {...(value.actionAttempt === undefined
            ? {}
            : { attempt: value.actionAttempt })}
          sections={value.sectionRoutes}
        />
        <TryoutSetResult value={value} />
      </TryoutPageBody>
    </TryoutPage>
  );
}

/** Composes the set action inside a score card only for terminal attempts. */
function TryoutSetResult({ value }: TryoutSetOverviewProps) {
  const attempt = value.actionAttempt;

  if (!attempt?.score) {
    return value.activeAttempt ? (
      <TryoutCountdown expiresAt={value.activeAttempt.expiresAt} />
    ) : null;
  }

  return (
    <TryoutAttemptResults
      value={{
        attempt: {
          attemptId: attempt.attemptId,
          attemptNumber: attempt.attemptNumber,
          score: attempt.score,
          startedAt: attempt.startedAt,
          status: attempt.status,
        },
        identity: {
          countryKey: value.page.set.countryKey,
          examKey: value.page.set.examKey,
          locale: value.route.locale,
          setKey: value.page.set.setKey,
          trackKey: value.page.set.trackKey,
        },
      }}
    />
  );
}
