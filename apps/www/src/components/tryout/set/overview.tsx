import {
  TryoutFinishedFacts,
  TryoutFinishedPanel,
  TryoutFinishedPanes,
  TryoutFinishedPlace,
} from "@/components/tryout/review/panes";
import { TryoutCountdown } from "@/components/tryout/runtime/countdown";
import { TryoutAttemptPicker } from "@/components/tryout/score/history";
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
        <TryoutAttemptPicker
          attempt={value.actionAttempt}
          locale={value.route.locale}
          set={value.page.set}
        />
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
        <TryoutFinishedPanes
          panel={
            <TryoutFinishedPanel runtime={null}>
              <TryoutFinishedFacts score={value.actionAttempt.score} />
            </TryoutFinishedPanel>
          }
        >
          <TryoutSetParts value={value} />
        </TryoutFinishedPanes>
      ) : (
        <TryoutPageBody>
          {value.activeAttempt ? (
            <TryoutCountdown expiresAt={value.activeAttempt.expiresAt} />
          ) : null}
          <TryoutSetParts value={value} />
          <TryoutFinishedPlace pending={value.actionAttempt === undefined} />
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
