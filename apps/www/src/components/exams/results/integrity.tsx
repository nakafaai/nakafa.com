import { QueryResult, useQuery } from "@confect/react";
import { SecurityCheckIcon } from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { IntegrityRow } from "@repo/backend/confect/exams/results/contract";
import { PopupHold } from "@repo/design-system/components/ui/hold";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { Array as Arr, Result } from "effect";
import { useFormatter, useTranslations } from "use-intl";
import {
  useResultsScope,
  useSessionSettled,
} from "@/components/exams/results/context";
import { AwayCell } from "@/components/exams/results/students";
import { PaneFill } from "@/components/shared/page/pane";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { RowCopy } from "@/components/shared/table/menu";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import { EmptyState } from "@/components/state/empty";
import { EmptyNina } from "@/components/state/nina";
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
      <EmptyState
        description={t("integrity-empty")}
        scene={<EmptyNina act="reading" />}
        title={t("integrity-empty-title")}
      />
    );
  }

  return (
    <TableFiltersProvider>
      <PaneFill
        head={
          <p className="text-muted-foreground text-sm">
            {t("integrity-clean", {
              clean: students - rows.length,
              students,
            })}
          </p>
        }
      >
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
      </PaneFill>
    </TableFiltersProvider>
  );
}

/**
 * The sitting's integrity report (K25) in a sheet, which the results header's Analysis menu opens, read only once
 * the teacher opens it. Its footer says what the report is, an indication for a teacher to
 * weigh, and it holds no action on a student, so nothing here decides anything.
 */
export function IntegritySheet({
  onOpenChange,
  open,
}: {
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
}) {
  const t = useTranslations("Exams");
  const { sittingId, slug } = useResultsScope();

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="sm:max-w-3xl">
        <SheetHeader className="flex-row items-center gap-3 pe-12">
          <HugeIcons className="size-5 shrink-0" icon={SecurityCheckIcon} />
          <SheetTitle>{t("integrity-title")}</SheetTitle>
        </SheetHeader>
        <ReadBoundary
          read={{
            args: { sittingId, slug },
            ref: exams.results.results.integrity,
          }}
        >
          <IntegrityRows />
        </ReadBoundary>
        <SheetFooter>
          <p className="text-muted-foreground text-sm">
            {t("integrity-description")}
          </p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
