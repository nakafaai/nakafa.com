import { QueryResult, useQuery } from "@confect/react";
import { FileExportIcon, UserMultiple02Icon } from "@hugeicons/core-free-icons";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { Array as Arr, Option } from "effect";
import { use } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { useTenant } from "@/components/tenant/context";
import {
  type GradeCohort,
  GradeDownloadContext,
} from "@/components/tenant/roster/download";
import { useRosterUnit } from "@/components/tenant/roster/unit";

/**
 * The report grades of the export menu (ADR 0033, S6): a submenu of the unit's class groups in its
 * active period, each of which saves its locked report cards as a workbook to paste into the template
 * Dapodik downloads for that class group and subject. It reads the class groups once it opens, and
 * the writer loads only when a file is asked for.
 */
export function RosterGradesExport() {
  const t = useTranslations("SchoolRoster");
  const common = useTranslations("Common");

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <HugeIcons icon={FileExportIcon} />
        {t("export-grades")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{common("menu-export")}</DropdownMenuLabel>
          <RosterGradeCohorts />
        </DropdownMenuGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
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
function RosterGradeItem({ cohort }: { cohort: GradeCohort }) {
  const download = use(GradeDownloadContext);

  return (
    <DropdownMenuItem onClick={() => download(cohort)}>
      <HugeIcons icon={UserMultiple02Icon} />
      {cohort.name}
    </DropdownMenuItem>
  );
}
