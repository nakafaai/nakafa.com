import { QueryResult, useQuery } from "@confect/react";
import { SecurityCheckIcon } from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { IntegrityRow } from "@repo/backend/confect/exams/results/contract";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/design-system/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr, Result } from "effect";
import { useFormatter, useTranslations } from "use-intl";
import {
  useResultsScope,
  useSessionSettled,
} from "@/components/exams/results/context";
import { AwayCell } from "@/components/exams/results/students";
import { TableEmpty } from "@/components/shared/table/frame";
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

/**
 * The signals of one student beside their exits, as one sentence: only the ones they showed, with how many of
 * each, and nothing when they showed none.
 */
function OtherSignals({ row }: { readonly row: typeof IntegrityRow.Type }) {
  const t = useTranslations("Exams");
  const format = useFormatter();
  const named = Arr.filterMap(SIGNALS, (kind) =>
    row[kind] === 0
      ? Result.failVoid
      : Result.succeed(t(`integrity-${kind}`, { count: row[kind] }))
  );

  return format.list(named, { type: "conjunction" });
}

/** The report once its read is in: who showed a signal, most time away first, and how many showed none. */
function IntegrityRows() {
  const t = useTranslations("Exams");
  const { sittingId, slug } = useResultsScope();
  const settled = useSessionSettled();
  const report = useQuery(
    exams.results.results.integrity,
    settled ? { sittingId, slug } : "skip"
  );

  if (QueryResult.isFailure(report)) {
    throw report.error;
  }
  if (!QueryResult.isSuccess(report)) {
    return null;
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-2 sm:px-4">{t("results-name")}</TableHead>
            <TableHead className="px-2 sm:px-4">{t("results-away")}</TableHead>
            <TableHead className="px-2 sm:px-4">
              {t("integrity-signals")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Arr.map(rows, (row) => (
            <TableRow key={row.attemptId}>
              <TableCell className="px-2 sm:px-4" dir="auto">
                {row.name}
              </TableCell>
              <TableCell className="px-2 tabular-nums sm:px-4">
                <AwayCell awaySeconds={row.awaySeconds} exits={row.exits} />
              </TableCell>
              <TableCell className="px-2 whitespace-normal sm:px-4">
                <OtherSignals row={row} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
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
  const common = useTranslations("Common");
  const { sittingId, slug } = useResultsScope();

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button type="button" variant="outline">
            <HugeIcons icon={SecurityCheckIcon} />
            <span className="max-sm:sr-only">{t("integrity")}</span>
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
        <SheetFooter>
          <SheetClose
            render={
              <Button type="button" variant="outline">
                {common("close")}
              </Button>
            }
          />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
