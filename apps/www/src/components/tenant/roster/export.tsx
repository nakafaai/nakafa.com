import { useAction } from "@confect/react";
import { Download01Icon, UserListIcon } from "@hugeicons/core-free-icons";
import roster from "@repo/backend/confect/_generated/refs/roster";
import type { RosterLine } from "@repo/backend/confect/roster/schema";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Array as Arr, Effect, Option } from "effect";
import { useTranslations } from "use-intl";
import { useLongAction } from "@/components/shared/pending";
import { useTenant } from "@/components/tenant/context";
import { saveLedger } from "@/components/tenant/graduation/save";
import { EXPORT_HEADER } from "@/components/tenant/roster/dapodik";
import {
  type GradeCohort,
  GradeDownloadContext,
} from "@/components/tenant/roster/download";
import { RosterGradesExport } from "@/components/tenant/roster/grades";
import { activePeriodOf } from "@/components/tenant/roster/period";
import { useRosterUnit } from "@/components/tenant/roster/unit";
import { saveSchool } from "@/components/tenant/settings/save";
import { reportClientException } from "@/lib/analytics/client";

const SOURCE = "components/tenant/roster/export";

/**
 * Writes the period's students into an XLSX file with the columns the import reads. The writer
 * loads only when the Admin asks for the file, and a file that cannot be written says so.
 */
const saveStudents = (lines: readonly (typeof RosterLine.Type)[]) =>
  Effect.tryPromise(async () => {
    const { default: writeXlsxFile } = await import("write-excel-file/browser");
    await writeXlsxFile([
      EXPORT_HEADER,
      ...Arr.map(lines, (line) => [
        line.name,
        line.nisn ?? "",
        line.cohortName,
      ]),
    ]).toFile("nakafa-dapodik.xlsx");
  }).pipe(
    Effect.catch((error) =>
      reportClientException(error, { source: SOURCE }).pipe(
        Effect.andThen(
          Effect.sync(() => {
            toast.error({ title: "school-roster-export-failed.title" });
          })
        )
      )
    )
  );

/**
 * Export: one menu of what the school takes back to Dapodik, so the header keeps its two buttons. The
 * first item writes the chosen unit's students of its active period into a file to compare with
 * Dapodik, which a unit without an active period refuses, and the second lists the class groups whose
 * report grades it saves. The button stands enabled from the first paint and shows its work only
 * while a file is saved.
 */
export function RosterExport() {
  const t = useTranslations("SchoolRoster");
  const { slug } = useTenant();
  const read = useRosterUnit();
  const exportLines = useAction(roster.exports.lines);
  const [isExporting, startExporting] = useLongAction();
  const unit = Option.flatMap(
    Option.fromUndefinedOr(read),
    (found) => found.unit
  );

  const saveStudentsOfUnit = () =>
    startExporting(() =>
      saveSchool(
        () =>
          Effect.runPromise(
            Effect.result(
              Effect.fromOption(unit).pipe(
                Effect.flatMap((found) => activePeriodOf(slug, found.id)),
                Effect.flatMap((periodId) =>
                  Effect.tryPromise(() => exportLines({ periodId, slug }))
                ),
                Effect.flatMap(Effect.fromResult)
              )
            )
          ),
        SOURCE,
        (lines) => {
          Effect.runFork(saveStudents(lines));
        }
      )
    );
  const saveGrades = (cohort: GradeCohort) =>
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
              <HugeIcons icon={Download01Icon} />
            )}
            <span className="max-sm:sr-only">{t("export")}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={saveStudentsOfUnit}>
            <HugeIcons icon={UserListIcon} />
            {t("export-students")}
          </DropdownMenuItem>
          <GradeDownloadContext value={saveGrades}>
            <RosterGradesExport />
          </GradeDownloadContext>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
