import { QueryResult, useMutation, useQuery } from "@confect/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import roster from "@repo/backend/confect/_generated/refs/roster";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { IMPORT_BATCH } from "@repo/backend/confect/roster/schema";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Array as Arr, Effect, Option } from "effect";
import { useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { TableEmpty } from "@/components/shared/table/frame";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { useTenant } from "@/components/tenant/context";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import {
  type FileProblem,
  RosterFileChoice,
} from "@/components/tenant/roster/choose";
import { type ReadRow, studentsOf } from "@/components/tenant/roster/dapodik";
import { RosterStudentsExport } from "@/components/tenant/roster/export";
import { RosterGradesExport } from "@/components/tenant/roster/grades";
import { activePeriodOf } from "@/components/tenant/roster/period";
import { RosterPreviewTable } from "@/components/tenant/roster/preview";
import {
  RosterUnitChoice,
  RosterUnitProvider,
  useRosterUnit,
} from "@/components/tenant/roster/unit";
import { saveSchool } from "@/components/tenant/settings/save";
import { SettingsTablePage } from "@/components/tenant/settings/section";
import type { UnitId } from "@/components/tenant/settings/unit";
import { NoActiveUnit } from "@/components/tenant/settings/unitless";

const SOURCE = "components/tenant/roster/import";

/**
 * The Dapodik import of the school (ADR 0015, K13): the Admin chooses the unit, reads a
 * Dapodik XLSX export, checks every row in the preview, and applies the students into the
 * unit's active period, or cancels and nothing is written. Export writes the period's
 * students back into a file to compare with Dapodik, and Export grades a class group's report data.
 */
export function RosterImportSettings() {
  const { slug } = useTenant();

  return (
    <TableFiltersProvider>
      <RosterUnitProvider>
        <ReadBoundary
          fallback={(failure) => (
            <SettingsTablePage>{failure}</SettingsTablePage>
          )}
          read={{ args: { slug }, ref: tenancy.viewer.get }}
        >
          <RosterImportContent />
        </ReadBoundary>
      </RosterUnitProvider>
    </TableFiltersProvider>
  );
}

/** The import of the chosen unit, once the viewer's units are in. */
function RosterImportContent() {
  const read = useRosterUnit();

  if (read === undefined) {
    return <SettingsTablePage>{null}</SettingsTablePage>;
  }
  if (Option.isNone(read.unit)) {
    return (
      <SettingsTablePage>
        <NoActiveUnit />
      </SettingsTablePage>
    );
  }
  return (
    <RosterImportOfUnit key={read.unit.value.id} unitId={read.unit.value.id} />
  );
}

/**
 * The import into one unit's active period. The header holds its actions enabled from the first
 * paint and waits for nothing: until a file is read the unit choice, Export, Export grades and
 * Import, each of which reads the period itself after its press, and the body says what to do; once
 * a file is read the header shows the search and status filter of the preview with Cancel and
 * Import students, and the preview is the body. The rows go to the server in batches of
 * `IMPORT_BATCH`, each one transaction, so a retry after a failed batch adds no duplicate.
 */
function RosterImportOfUnit({ unitId }: { unitId: UnitId }) {
  const t = useTranslations("SchoolRoster");
  const { slug } = useTenant();
  const apply = useMutation(roster.imports.apply);
  const [preview, setPreview] = useState<
    readonly (typeof ReadRow.Type)[] | undefined
  >(undefined);
  const [problem, setProblem] = useState<FileProblem | undefined>(undefined);
  const [isApplying, startApplying] = useTransition();

  // The press reads the period, then the batches go one after another and stop at the first refusal,
  // which the save reports.
  const applyBatches = (rows: readonly (typeof ReadRow.Type)[]) =>
    Effect.runPromise(
      Effect.result(
        activePeriodOf(slug, unitId).pipe(
          Effect.flatMap((periodId) =>
            Effect.forEach(
              Arr.chunksOf(studentsOf(rows), IMPORT_BATCH),
              (batch) =>
                Effect.tryPromise(() =>
                  apply({ periodId, rows: batch, slug })
                ).pipe(Effect.flatMap(Effect.fromResult)),
              { discard: true }
            )
          )
        )
      )
    );

  const submit = (rows: readonly (typeof ReadRow.Type)[]) =>
    startApplying(() =>
      saveSchool(
        () => applyBatches(rows),
        SOURCE,
        () => {
          toast.success({ title: "school-roster-imported.title" });
          setPreview(undefined);
        }
      )
    );

  if (preview !== undefined) {
    return (
      <SettingsTablePage
        actions={
          <>
            <TableSearch placeholder={t("search")} />
            <Button
              disabled={isApplying}
              onClick={() => setPreview(undefined)}
              type="button"
              variant="outline"
            >
              <HugeIcons icon={Cancel01Icon} />
              <span className="max-sm:sr-only">{t("cancel")}</span>
            </Button>
            <Button
              disabled={
                isApplying || Arr.isReadonlyArrayEmpty(studentsOf(preview))
              }
              onClick={() => submit(preview)}
              type="button"
            >
              <Spinner isLoading={isApplying} />
              {t("apply")}
            </Button>
          </>
        }
      >
        <RosterPreviewTable rows={preview} />
      </SettingsTablePage>
    );
  }
  return (
    <SettingsTablePage
      actions={
        <>
          <RosterUnitChoice />
          <RosterStudentsExport />
          <RosterGradesExport />
          <RosterFileChoice
            onProblem={setProblem}
            onRows={(rows) => {
              setProblem(undefined);
              setPreview(rows);
            }}
          />
        </>
      }
    >
      <RosterImportEmpty problem={problem} unitId={unitId} />
    </SettingsTablePage>
  );
}

/**
 * The body of the import before a file is read, drawn from the first paint: what to do, or the
 * reason a file was refused. A unit that turns out to have no active period says the period comes
 * first instead.
 */
function RosterImportEmpty({
  problem,
  unitId,
}: {
  problem: FileProblem | undefined;
  unitId: UnitId;
}) {
  const t = useTranslations("SchoolRoster");
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const active = useQuery(
    tenancy.cohorts.activePeriod,
    isSettled ? { slug, unitId } : "skip"
  );
  if (QueryResult.isFailure(active)) {
    throw active.error;
  }

  if (QueryResult.isSuccess(active) && active.value === null) {
    return (
      <TableEmpty
        act="pointing"
        description={t("no-period-description")}
        title={t("no-period")}
      />
    );
  }
  return (
    <TableEmpty
      act={problem === undefined ? "reading" : "pointing"}
      description={t(
        problem === undefined ? "empty-description" : `file-${problem}`
      )}
      title={t(problem === undefined ? "empty" : "file-refused")}
    />
  );
}
