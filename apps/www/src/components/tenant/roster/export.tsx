import { useAction } from "@confect/react";
import { Download01Icon } from "@hugeicons/core-free-icons";
import roster from "@repo/backend/confect/_generated/refs/roster";
import type { RosterLine } from "@repo/backend/confect/roster/schema";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Array as Arr, Effect, Option } from "effect";
import { useTransition } from "react";
import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { EXPORT_HEADER } from "@/components/tenant/roster/dapodik";
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
 * Export: the chosen unit's students of its active period, written back into a file to compare with
 * Dapodik. The button stands enabled from the first paint; the press reads the period itself, which a
 * unit without an active period refuses, and the button shows its work only after the press.
 */
export function RosterStudentsExport() {
  const t = useTranslations("SchoolRoster");
  const { slug } = useTenant();
  const read = useRosterUnit();
  const exportLines = useAction(roster.exports.lines);
  const [isExporting, startExporting] = useTransition();
  const unit = Option.flatMap(
    Option.fromUndefinedOr(read),
    (found) => found.unit
  );

  const download = () =>
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

  return (
    <Button
      disabled={isExporting}
      onClick={download}
      type="button"
      variant="outline"
    >
      {isExporting ? (
        <Spinner isLoading />
      ) : (
        <HugeIcons icon={Download01Icon} />
      )}
      <span className="max-sm:sr-only">{t("export")}</span>
    </Button>
  );
}
