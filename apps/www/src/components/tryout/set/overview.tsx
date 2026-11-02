import { TryoutFinishedPanes } from "@/components/tryout/review/panes";
import { TryoutCountdown } from "@/components/tryout/runtime/countdown";
import { TryoutAttemptResults } from "@/components/tryout/score/history";
import { TryoutSetAction } from "@/components/tryout/set/action";
import { TryoutSetPageHeader } from "@/components/tryout/set/header";
import type {
  CurrentAttempt,
  SetEntrySection,
  SetPage,
  TryoutSetDestination,
  TryoutSetRoute,
} from "@/components/tryout/set/model";
import { TryoutSectionRows } from "@/components/tryout/set/rows";
import { TryoutPage, TryoutPageBody } from "@/components/tryout/shell/header";

/** Props of the set overview: one cohesive render model shared by its surfaces. */
export interface TryoutSetOverviewProps {
  /** Cohesive render model shared by set overview surfaces. */
  value: {
    actionAttempt?: CurrentAttempt | null;
    activeAttempt: CurrentAttempt | null;
    currentPath: string;
    entrySection: SetEntrySection | null;
    page: SetPage;
    returnPath: string;
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
 * Renders a set page that offers visible nested sections. A finished attempt's
 * parts stand beside its result and history; a running attempt's countdown stands
 * above its parts.
 */
export function TryoutSetOverview({ value }: TryoutSetOverviewProps) {
  return (
    <TryoutPage>
      <TryoutSetPageHeader
        currentPath={value.currentPath}
        page={value.page}
        returnPath={value.returnPath}
      >
        <TryoutSetAction
          value={{
            activeAttempt: value.activeAttempt,
            currentPath: value.currentPath,
            ...(value.actionAttempt === undefined
              ? {}
              : { currentAttempt: value.actionAttempt }),
            destination: value.start.destination,
            entrySection: value.start.entrySection,
            locale: value.route.locale,
            set: value.start.set,
          }}
        />
      </TryoutSetPageHeader>
      {value.actionAttempt?.score ? (
        <TryoutFinishedPanes panel={<TryoutSetResult value={value} />}>
          <TryoutSetParts value={value} />
        </TryoutFinishedPanes>
      ) : (
        <TryoutPageBody>
          <TryoutSetResult value={value} />
          <TryoutSetParts value={value} />
        </TryoutPageBody>
      )}
    </TryoutPage>
  );
}

/** The set's parts, with the attempt that marks them once it is known. */
function TryoutSetParts({ value }: TryoutSetOverviewProps) {
  return (
    <TryoutSectionRows
      {...(value.actionAttempt === undefined
        ? {}
        : { attempt: value.actionAttempt })}
      sections={value.sectionRoutes}
    />
  );
}

/** The finished attempt's result, or the running attempt's countdown. */
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
        publicPath: value.page.set.publicPath,
      }}
    />
  );
}
