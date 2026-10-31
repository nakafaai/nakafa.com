import type { Ref } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import { FileExportIcon, UserMultiple02Icon } from "@hugeicons/core-free-icons";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { Array as Arr, Effect, Option } from "effect";
import { createContext, use, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { useTenant } from "@/components/tenant/context";
import { saveLedger } from "@/components/tenant/graduation/save";
import { useRosterUnit } from "@/components/tenant/roster/unit";

/** One class group of the period, as the export menu lists it. */
type CohortChoice = Ref.Returns<typeof tenancy.cohorts.list>[number];

/** The save of one class group's report data, which the menu's items run when chosen. */
const GradeDownloadContext = createContext<(cohort: CohortChoice) => void>(
  () => undefined
);

/**
 * The Dapodik export of report data (ADR 0033, S6): a menu of the unit's class groups in its active
 * period, each of which saves its locked report cards as a workbook to paste into the template
 * Dapodik downloads for that class group and subject. The button stands enabled from the first
 * paint; the menu reads the class groups once it opens, and the button shows its work only while a
 * file is saved. The writer loads only when a file is asked for.
 */
export function RosterGradesExport() {
  const t = useTranslations("SchoolRoster");
  const { slug } = useTenant();
  const [isExporting, startExporting] = useTransition();

  const download = (cohort: CohortChoice) =>
    startExporting(() =>
      Effect.runPromise(saveLedger(slug, { id: cohort.id, name: cohort.name }))
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button disabled={isExporting} type="button" variant="outline">
            {isExporting ? (
              <Spinner isLoading />
            ) : (
              <HugeIcons icon={FileExportIcon} />
            )}
            <span className="max-sm:sr-only">{t("export-grades")}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("export-grades-label")}</DropdownMenuLabel>
          <GradeDownloadContext value={download}>
            <RosterGradeCohorts />
          </GradeDownloadContext>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The open menu's class groups: the active ones of the chosen unit's active period, each an item that
 * saves its report data; a line while they are read; and a line for a unit without an active
 * period or a period without a class group.
 */
function RosterGradeCohorts() {
  const t = useTranslations("SchoolRoster");
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const read = useRosterUnit();
  const unit = Option.flatMap(
    Option.fromUndefinedOr(read),
    (found) => found.unit
  );
  const period = useQuery(
    tenancy.cohorts.activePeriod,
    isSettled && Option.isSome(unit) ? { slug, unitId: unit.value.id } : "skip"
  );
  const periodId = QueryResult.isSuccess(period) ? period.value : null;
  const cohorts = useQuery(
    tenancy.cohorts.list,
    periodId === null ? "skip" : { periodId, slug }
  );

  if (QueryResult.isSuccess(period) && period.value === null) {
    return (
      <DropdownMenuItem disabled>
        {t("export-grades-no-period")}
      </DropdownMenuItem>
    );
  }
  if (!QueryResult.isSuccess(cohorts)) {
    return (
      <DropdownMenuItem disabled>
        <Spinner isLoading />
        {t("export-grades-loading")}
      </DropdownMenuItem>
    );
  }
  const active = Arr.filter(
    cohorts.value,
    (cohort) => cohort.status === "active"
  );
  if (Arr.isReadonlyArrayEmpty(active)) {
    return (
      <DropdownMenuItem disabled>{t("export-grades-empty")}</DropdownMenuItem>
    );
  }
  return Arr.map(active, (cohort) => (
    <RosterGradeItem cohort={cohort} key={cohort.id} />
  ));
}

/** One class group of the export menu, which saves its report data when chosen. */
function RosterGradeItem({ cohort }: { cohort: CohortChoice }) {
  const download = use(GradeDownloadContext);

  return (
    <DropdownMenuItem onClick={() => download(cohort)}>
      <HugeIcons icon={UserMultiple02Icon} />
      {cohort.name}
    </DropdownMenuItem>
  );
}
