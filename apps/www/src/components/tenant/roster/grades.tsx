import type { GenericId, Ref } from "@confect/core";
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
import { Array as Arr, Effect } from "effect";
import { useTransition } from "react";
import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { saveLedger } from "@/components/tenant/graduation/save";

/** One class group of the period, as the export menu lists it. */
type CohortChoice = Ref.Returns<typeof tenancy.cohorts.list>[number];

/**
 * The Dapodik export of report data (ADR 0033, S6): a menu of the period's active class groups,
 * each of which saves its locked report cards as a workbook to paste into the template Dapodik
 * downloads for that class group and subject. The writer loads only when a file is asked for.
 */
export function RosterGradesExport({
  periodId,
}: {
  periodId: GenericId.GenericId<"tenantPeriods">;
}) {
  const t = useTranslations("SchoolRoster");
  const { slug } = useTenant();
  const cohorts = useQuery(tenancy.cohorts.list, { periodId, slug });
  const [isExporting, startExporting] = useTransition();
  const active = QueryResult.isSuccess(cohorts)
    ? Arr.filter(cohorts.value, (cohort) => cohort.status === "active")
    : [];

  const download = (cohort: CohortChoice) =>
    startExporting(() =>
      Effect.runPromise(saveLedger(slug, { id: cohort.id, name: cohort.name }))
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            disabled={isExporting || !QueryResult.isSuccess(cohorts)}
            type="button"
            variant="outline"
          >
            {isExporting ? (
              <Spinner isLoading />
            ) : (
              <HugeIcons icon={FileExportIcon} />
            )}
            {t("export-grades")}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("export-grades-label")}</DropdownMenuLabel>
          {Arr.isReadonlyArrayEmpty(active) ? (
            <DropdownMenuItem disabled>
              {t("export-grades-empty")}
            </DropdownMenuItem>
          ) : null}
          {Arr.map(active, (cohort) => (
            <RosterGradeItem
              cohort={cohort}
              key={cohort.id}
              onChoose={download}
            />
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** One class group of the export menu, which saves its report data when chosen. */
function RosterGradeItem({
  cohort,
  onChoose,
}: {
  cohort: CohortChoice;
  onChoose: (cohort: CohortChoice) => void;
}) {
  return (
    <DropdownMenuItem onClick={() => onChoose(cohort)}>
      <HugeIcons icon={UserMultiple02Icon} />
      {cohort.name}
    </DropdownMenuItem>
  );
}
