import { QueryResult, useQuery } from "@confect/react";
import { SecurityCheckIcon } from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { IntegrityRow } from "@repo/backend/confect/exams/results/contract";
import { Button } from "@repo/design-system/components/ui/button";
import { PopupHold } from "@repo/design-system/components/ui/hold";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/design-system/components/ui/sheet";
import { Array as Arr, Result } from "effect";
import { useFormatter, useTranslations } from "use-intl";
import {
  useResultsScope,
  useSessionSettled,
} from "@/components/exams/results/context";
import { AwayCell } from "@/components/exams/results/students";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TableEmpty, TableFrame } from "@/components/shared/table/frame";
import { RowCopy } from "@/components/shared/table/menu";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import { ReadBoundary } from "@/components/tenant/read/boundary";

/** The signals a report counts beside the exits, in the order a row names them. */
const SIGNALS = [
  "disconnect",
  "blur",
  "fullscreenExit",
  "secondTab",
  "copy",
  "paste",
] as const;

/** The columns of the report. */
const integrityColumns = tableColumns<typeof IntegrityRow.Type>();

/**
 * The signals of one student beside their exits, as one sentence: only the ones they showed, with how many of
 * each, and nothing when they showed none.
 */
function useOtherSignals() {
  const t = useTranslations("Exams");
  const format = useFormatter();

  return (row: typeof IntegrityRow.Type) =>
    format.list(
      Arr.filterMap(SIGNALS, (kind) =>
        row[kind] === 0
          ? Result.failVoid
          : Result.succeed(t(`integrity-${kind}`, { count: row[kind] }))
      ),
      { type: "conjunction" }
    );
}

/** The report once its read is in: who showed a signal, most time away first, and how many showed none. */
function IntegrityRows() {
  const t = useTranslations("Exams");
  const { sittingId, slug } = useResultsScope();
  const settled = useSessionSettled();
  const signalsOf = useOtherSignals();
  const report = useQuery(
    exams.results.results.integrity,
    settled ? { sittingId, slug } : "skip"
  );

  if (QueryResult.isFailure(report)) {
    throw report.error;
  }
  if (!QueryResult.isSuccess(report)) {
    return <PopupHold />;
  }
  const { rows, students } = report.value;
  if (Arr.isReadonlyArrayEmpty(rows)) {
    return (
      <TableEmpty
        act="reading"
        description={t("integrity-empty")}
        title={t("integrity-empty-title")}
      />
    );
  }

  return (
    <div className="grid gap-4">
      <p className="text-muted-foreground text-sm">
        {t("integrity-clean", {
          clean: students - rows.length,
          students,
        })}
      </p>
      <TableFiltersProvider>
        <TableFrame>
          <DataTable
            columns={[
              integrityColumns.text((row) => row.name, {
                header: t("results-name"),
                id: "name",
              }),
              integrityColumns.number((row) => row.awaySeconds, {
                cell: (info) => (
                  <AwayCell
                    awaySeconds={info.row.original.awaySeconds}
                    exits={info.row.original.exits}
                  />
                ),
                header: t("results-away"),
                id: "away",
              }),
              integrityColumns.text(signalsOf, {
                header: t("integrity-signals"),
                id: "signals",
              }),
              integrityColumns.menu((info) => (
                <RowCopy value={info.row.original.name} />
              )),
            ]}
            data={rows}
            plain
            rowId={(row) => row.attemptId}
          />
        </TableFrame>
      </TableFiltersProvider>
    </div>
  );
}

/**
 * Integrity, in the results page's header row: it opens the sitting's integrity report (K25) in a sheet, read only
 * once the teacher opens it. The sheet says what the report is before anything else, an indication for a teacher to
 * weigh, and it holds no action on a student, so nothing here decides anything.
 */
export function IntegrityAction() {
  const t = useTranslations("Exams");
  const { sittingId, slug } = useResultsScope();

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button type="button" variant="outline">
            <HugeIcons icon={SecurityCheckIcon} />
            <span className="@max-3xl/header:sr-only">{t("integrity")}</span>
          </Button>
        }
      />
      <SheetContent className="sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{t("integrity-title")}</SheetTitle>
          <SheetDescription>{t("integrity-description")}</SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="p-4">
            <ReadBoundary
              read={{
                args: { sittingId, slug },
                ref: exams.results.results.integrity,
              }}
            >
              <IntegrityRows />
            </ReadBoundary>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
