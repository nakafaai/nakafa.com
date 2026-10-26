import type { GenericId } from "@confect/core";
import { QueryResult, useAction, useMutation, useQuery } from "@confect/react";
import roster from "@repo/backend/confect/_generated/refs/roster";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { IMPORT_BATCH } from "@repo/backend/confect/roster/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { toast } from "@repo/design-system/lib/toast/notify";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr, DateTime, Effect, Option, Result } from "effect";
import { type ReactNode, useRef, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { useViewerQuery } from "@/components/tenant/context";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import {
  EXPORT_HEADER,
  type ReadRow,
  RowProblem,
  readDapodikSheet,
  type SheetProblem,
  studentsOf,
} from "@/components/tenant/roster/dapodik";
import { saveSchool } from "@/components/tenant/settings/save";
import { SettingsPage } from "@/components/tenant/settings/section";
import {
  SchoolUnitChoice,
  type UnitId,
} from "@/components/tenant/settings/unit";
import { NoActiveUnit } from "@/components/tenant/settings/unitless";
import { reportClientException } from "@/lib/analytics/client";

const SOURCE = "components/tenant/roster/import";

/** The file types the chooser offers: the XLSX file that Dapodik exports. */
const SHEET_TYPES =
  ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** The columns of the preview table. */
const rowColumns = createColumnHelper<
  typeof dataTableFeatures,
  typeof ReadRow.Type
>();

/** The status of one read row: under or over the age limit, or the problem that keeps it out. */
const statusOf = (row: typeof ReadRow.Type) => {
  if (row.outcome === "problem") {
    return row.problem;
  }
  return row.row.underAgeLimit ? "under" : "adult";
};

/** Why a chosen file shows no preview: its sheet is refused, or the file cannot be read at all. */
type FileProblem = typeof SheetProblem.Type | "unreadable";

/**
 * Reads the first sheet of an XLSX file in the browser. The reader loads only when the Admin
 * chooses a file, so it stays out of the page's first JavaScript, and the file never leaves
 * the device: only the rows the Admin applies reach the server (ADR 0015).
 */
const readFile = (file: File, today: DateTime.Utc) =>
  Effect.tryPromise(async () => {
    const { readSheet } = await import("read-excel-file/browser");
    return readSheet(file);
  }).pipe(Effect.map((rows) => readDapodikSheet(rows, today)));

/** Writes the period's students into an XLSX file with the columns the import reads. */
const writeFile = (
  lines: readonly {
    readonly cohortName: string;
    readonly name: string;
    readonly nisn: string | null;
  }[]
) =>
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
  });

/**
 * The Dapodik import of the school (ADR 0015, K13): the Admin chooses the unit, reads a
 * Dapodik XLSX export, checks every row in the preview, and applies the students into the
 * unit's active period, or cancels and nothing is written. Export writes the period's
 * students back into a file to compare with Dapodik.
 */
export function RosterImportSettings({ slug }: { slug: TenantSlug }) {
  return (
    <ReadBoundary
      fallback={(failure) => <SettingsPage>{failure}</SettingsPage>}
      read={{ args: { slug }, ref: tenancy.viewer.get }}
    >
      <RosterImportContent slug={slug} />
    </ReadBoundary>
  );
}

/** The import of the school's active unit, once the viewer's units are in. */
function RosterImportContent({ slug }: { slug: TenantSlug }) {
  const viewer = useViewerQuery();
  const [chosenUnit, setChosenUnit] = useState<UnitId | undefined>(undefined);

  if (QueryResult.isFailure(viewer)) {
    throw viewer.error;
  }
  if (!QueryResult.isSuccess(viewer)) {
    return <SettingsPage>{null}</SettingsPage>;
  }
  const units = viewer.value.units;
  const unit = Option.getOrUndefined(
    Arr.findFirst(units, (candidate) =>
      chosenUnit === undefined
        ? candidate.status === "active"
        : candidate.id === chosenUnit
    )
  );
  if (unit === undefined) {
    return (
      <SettingsPage>
        <NoActiveUnit />
      </SettingsPage>
    );
  }
  return (
    <RosterImportOfUnit
      choice={
        units.length > 1 ? (
          <SchoolUnitChoice
            onChoose={setChosenUnit}
            unitId={unit.id}
            units={units}
          />
        ) : null
      }
      key={unit.id}
      slug={slug}
      unitId={unit.id}
    />
  );
}

/** The import into one unit's active period, or the state of a unit that has none. */
function RosterImportOfUnit({
  choice,
  slug,
  unitId,
}: {
  choice: ReactNode;
  slug: TenantSlug;
  unitId: UnitId;
}) {
  const t = useTranslations("SchoolRoster");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const active = useQuery(
    tenancy.cohorts.activePeriod,
    isSettled ? { slug, unitId } : "skip"
  );
  if (QueryResult.isFailure(active)) {
    throw active.error;
  }
  const periodId = QueryResult.isSuccess(active) ? active.value : undefined;

  if (periodId === undefined) {
    return <SettingsPage>{choice}</SettingsPage>;
  }
  if (periodId === null) {
    return (
      <SettingsPage>
        {choice}
        <TableEmpty
          act="pointing"
          description={t("no-period-description")}
          title={t("no-period")}
        />
      </SettingsPage>
    );
  }
  return (
    <RosterImportOfPeriod choice={choice} periodId={periodId} slug={slug} />
  );
}

/**
 * The import into one active period. Until a file is read the page shows Export and Import
 * in its header; once a file is read it shows the preview, with Cancel and Import students.
 * The rows go to the server in batches of `IMPORT_BATCH`, each one transaction, so a retry
 * after a failed batch adds no duplicate.
 */
function RosterImportOfPeriod({
  choice,
  periodId,
  slug,
}: {
  choice: ReactNode;
  periodId: GenericId.GenericId<"tenantPeriods">;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolRoster");
  const apply = useMutation(roster.imports.apply);
  const exportLines = useAction(roster.exports.lines);
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<
    readonly (typeof ReadRow.Type)[] | undefined
  >(undefined);
  const [problem, setProblem] = useState<FileProblem | undefined>(undefined);
  const [isReading, startReading] = useTransition();
  const [isApplying, startApplying] = useTransition();
  const [isExporting, startExporting] = useTransition();

  const choose = (file: File) =>
    startReading(async () => {
      const read = await Effect.runPromise(
        Effect.result(readFile(file, DateTime.nowUnsafe()))
      );
      if (Result.isFailure(read)) {
        setProblem("unreadable");
        return;
      }
      if (read.success.outcome === "refused") {
        setProblem(read.success.problem);
        return;
      }
      setProblem(undefined);
      setPreview(read.success.rows);
    });

  const submit = (rows: readonly (typeof ReadRow.Type)[]) =>
    startApplying(async () => {
      for (const batch of Arr.chunksOf(studentsOf(rows), IMPORT_BATCH)) {
        let applied = false;
        await saveSchool(
          () => apply({ periodId, rows: batch, slug }),
          SOURCE,
          () => {
            applied = true;
          }
        );
        if (!applied) {
          return;
        }
      }
      toast.success({ title: "school-roster-imported.title" });
      setPreview(undefined);
    });

  const download = () =>
    startExporting(() =>
      saveSchool(
        () => exportLines({ periodId, slug }),
        SOURCE,
        (lines) => {
          Effect.runFork(
            writeFile(lines).pipe(
              Effect.catch((error) =>
                reportClientException(error, { source: SOURCE }).pipe(
                  Effect.andThen(
                    Effect.sync(() => {
                      toast.error({
                        title: "school-roster-export-failed.title",
                      });
                    })
                  )
                )
              )
            )
          );
        }
      )
    );

  if (preview !== undefined) {
    return (
      <SettingsPage
        actions={
          <>
            <Button
              disabled={isApplying}
              onClick={() => setPreview(undefined)}
              type="button"
              variant="outline"
            >
              {t("cancel")}
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
        <RosterPreview rows={preview} />
      </SettingsPage>
    );
  }
  return (
    <SettingsPage
      actions={
        <>
          <input
            accept={SHEET_TYPES}
            aria-label={t("file-label")}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) {
                choose(file);
              }
            }}
            ref={input}
            type="file"
          />
          <Button
            disabled={isExporting}
            onClick={download}
            type="button"
            variant="outline"
          >
            <Spinner isLoading={isExporting} />
            {t("export")}
          </Button>
          <Button
            disabled={isReading}
            onClick={() => input.current?.click()}
            type="button"
          >
            <Spinner isLoading={isReading} />
            {t("import")}
          </Button>
        </>
      }
    >
      {choice}
      <TableEmpty
        act={problem === undefined ? "reading" : "pointing"}
        description={t(
          problem === undefined ? "empty-description" : `file-${problem}`
        )}
        title={t(problem === undefined ? "empty" : "file-refused")}
      />
    </SettingsPage>
  );
}

/** Every read row of the file with its status, so the Admin sees each row a problem keeps out. */
function RosterPreview({ rows }: { rows: readonly (typeof ReadRow.Type)[] }) {
  const t = useTranslations("SchoolRoster");
  const columns = rowColumns.columns([
    rowColumns.accessor((row) => row.line, {
      header: t("line"),
      id: "line",
      sortFn: "basic",
    }),
    rowColumns.accessor((row) => (row.outcome === "row" ? row.row.name : ""), {
      cell: (info) => (
        <span className="font-medium" dir="auto">
          {info.getValue()}
        </span>
      ),
      filterFn: "includesString",
      header: t("name"),
      id: "name",
      sortFn: "text",
    }),
    rowColumns.accessor((row) => (row.outcome === "row" ? row.row.nisn : ""), {
      cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
      enableSorting: false,
      header: t("nisn"),
      id: "nisn",
    }),
    rowColumns.accessor(
      (row) => (row.outcome === "row" ? (row.row.cohortName ?? "") : ""),
      { header: t("cohort"), id: "cohort", sortFn: "text" }
    ),
    rowColumns.accessor(statusOf, {
      cell: (info) => t(`status-${info.getValue()}`),
      enableSorting: false,
      filterFn: "oneOf",
      header: t("status"),
      id: "status",
    }),
  ]);

  return (
    <DataTable
      columns={columns}
      data={rows}
      facets={[
        {
          column: "status",
          options: Arr.map(
            ["under", "adult", ...RowProblem.literals] as const,
            (status) => ({ label: t(`status-${status}`), value: status })
          ),
          title: t("status"),
        },
      ]}
      rowId={(row) => String(row.line)}
      search={{ column: "name", placeholder: t("search") }}
    />
  );
}
