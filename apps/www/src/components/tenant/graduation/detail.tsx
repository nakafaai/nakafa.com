import {
  CheckmarkBadge01Icon,
  Download04Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  TableCell,
  TableFooter,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr, Option } from "effect";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import {
  PaneBody,
  PaneFact,
  PaneFacts,
  PaneFooter,
  PaneHeader,
} from "@/components/shared/pane";
import { usePanes } from "@/components/shared/panes";
import { columnAlign } from "@/components/shared/table/align";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TableFrame } from "@/components/shared/table/frame";
import { RowCopy } from "@/components/shared/table/menu";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import type { GraduationLine } from "@/components/tenant/graduation/sheet";
import { checkAddress } from "@/components/tenant/reports/check";

/** The columns of a transcript. */
const subjectColumns =
  tableColumns<NonNullable<GraduationLine["transcript"]>["subjects"][number]>();

/**
 * The open student's graduation: whether a NISN is on file, their SKL's number and state, what
 * is missing for it, and their transcript data, each subject with its value to two decimals and
 * the average; then the SKL's PDF and its check page once it is locked. A student the list no
 * longer holds closes.
 */
export function GraduationLineDetail({
  lines,
}: {
  lines: readonly GraduationLine[];
}) {
  const t = useTranslations("SchoolGraduation");
  const locale = useLocale();
  const format = useFormatter();
  const open = usePanes((state) => state.open);
  const line = Option.flatMap(open, (id) =>
    Arr.findFirst(lines, (candidate) => candidate.student.id === id)
  );

  if (Option.isNone(line)) {
    return null;
  }
  const found = line.value;
  const twoDecimals = (value: number) =>
    format.number(value, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });

  return (
    <>
      <PaneHeader
        description={t(`letter-${found.letter?.state ?? "none"}`)}
        title={found.student.name}
      />
      <PaneBody>
        <div className="flex flex-col gap-6">
          <PaneFacts>
            <PaneFact label={t("nisn")}>
              {t(`nisn-${found.hasNisn ? "yes" : "no"}`)}
            </PaneFact>
            {found.letter === null ? null : (
              <PaneFact label={t("letter-number")}>
                <span className="tabular-nums">{found.letter.number}</span>
              </PaneFact>
            )}
            <PaneFact label={t("ready")}>
              {Arr.isReadonlyArrayEmpty(found.missing)
                ? t("ready-ready")
                : Arr.join(
                    Arr.map(found.missing, (missing) => t(`ready-${missing}`)),
                    ", "
                  )}
            </PaneFact>
          </PaneFacts>
          {found.transcript === null ? (
            <p className="text-muted-foreground text-sm">
              {t("transcript-empty")}
            </p>
          ) : (
            <TableFiltersProvider>
              <TableFrame>
                <DataTable
                  columns={[
                    subjectColumns.text((subject) => subject.subject, {
                      cell: (info) => <span dir="auto">{info.getValue()}</span>,
                      header: t("subject"),
                      id: "subject",
                    }),
                    subjectColumns.number((subject) => subject.value, {
                      cell: (info) => twoDecimals(info.getValue()),
                      header: t("value"),
                      id: "value",
                    }),
                    subjectColumns.menu((info) => (
                      <RowCopy value={info.row.original.subject} />
                    )),
                  ]}
                  data={found.transcript.subjects}
                  plain
                  rowId={(subject) => subject.subject}
                >
                  <TableFooter>
                    <TableRow>
                      <TableCell className={columnAlign({ align: "start" })}>
                        {t("average")}
                      </TableCell>
                      <TableCell className={columnAlign()}>
                        {twoDecimals(found.transcript.average)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </DataTable>
              </TableFrame>
            </TableFiltersProvider>
          )}
        </div>
      </PaneBody>
      {found.letter === null || found.letter.file === null ? null : (
        <PaneFooter>
          <Button
            render={
              <a
                href={checkAddress(locale, found.letter.hash)}
                rel="noopener"
                target="_blank"
              >
                <HugeIcons icon={CheckmarkBadge01Icon} />
                {t("open-check")}
              </a>
            }
            variant="outline"
          />
          <Button
            render={
              <a href={found.letter.file} rel="noopener" target="_blank">
                <HugeIcons icon={Download04Icon} />
                {t("open-letter")}
              </a>
            }
          />
        </PaneFooter>
      )}
    </>
  );
}
