import {
  IdentityCardIcon,
  UserCheck01Icon,
  UserMultiple02Icon,
  UserQuestion01Icon,
} from "@hugeicons/core-free-icons";
import { Array as Arr, Order } from "effect";
import { useTranslations } from "use-intl";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { namedOptions } from "@/components/shared/table/filter";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import { TableName } from "@/components/shared/table/title";
import { type ReadRow, RowProblem } from "@/components/tenant/roster/dapodik";
import { GRADE_ICONS } from "@/components/tenant/settings/choices";

/**
 * The look of each status, in the preview's status cell and in its column's filter, one icon per
 * status: a row that imports, and the problem that keeps each other row out,
 * which reads as a danger.
 */
const ROSTER_STATUS_LOOKS = {
  cohort: { icon: UserMultiple02Icon, tone: "destructive" },
  name: { icon: UserQuestion01Icon, tone: "destructive" },
  nisn: { icon: IdentityCardIcon, tone: "destructive" },
  ready: { icon: UserCheck01Icon, tone: "success" },
} as const satisfies Record<typeof RowProblem.Type | "ready", StatusLook>;

/** The columns of the preview table. */
const rowColumns = tableColumns<typeof ReadRow.Type>();

/** The status of one read row: ready, or the problem that keeps it out. */
const statusOf = (row: typeof ReadRow.Type) => {
  if (row.outcome === "problem") {
    return row.problem;
  }
  return "ready";
};

/** The class group a read row names, or none for a row that a problem keeps out. */
const cohortOf = (row: typeof ReadRow.Type) =>
  row.outcome === "problem" ? "" : (row.row.cohortName ?? "");

/** The name a read row holds, or none for a row that a problem keeps out. */
const nameOf = (row: typeof ReadRow.Type) =>
  row.outcome === "problem" ? "" : row.row.name;

/** The identity a read row holds: its NISN, or the source's identity. */
const identityOf = (row: typeof ReadRow.Type) => {
  if (row.outcome === "problem") {
    return "";
  }
  return row.outcome === "row" ? row.row.nisn : row.row.sourcedId;
};

/**
 * The preview of a read file: each row, its class group and its status, which shows the rows a problem keeps out. The
 * header's search finds a row by its name or its NISN, and the class group and status heads filter the rows.
 */
export function RosterPreviewTable({
  rows,
}: {
  readonly rows: readonly (typeof ReadRow.Type)[];
}) {
  const t = useTranslations("SchoolRoster");
  const cohorts = Arr.sort(
    Arr.filter(Arr.dedupe(Arr.map(rows, cohortOf)), (cohort) => cohort !== ""),
    Order.String
  );

  const columns = [
    rowColumns.number((row) => row.line, { header: t("line"), id: "line" }),
    // The name with its identity after it, so the header's search finds a row by either; the cell shows the name alone.
    rowColumns.text((row) => `${nameOf(row)} ${identityOf(row)}`, {
      cell: (info) =>
        info.row.original.outcome === "problem" ? null : (
          <TableName>{nameOf(info.row.original)}</TableName>
        ),
      header: t("name"),
      id: "name",
    }),
    rowColumns.text(identityOf, {
      cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
      header: t("nisn"),
      id: "nisn",
    }),
    rowColumns.values(cohortOf, {
      header: t("cohort"),
      id: "cohort",
      options: namedOptions(cohorts, GRADE_ICONS),
    }),
    rowColumns.values(statusOf, {
      cell: (info) => (
        <TableStatus
          icon={ROSTER_STATUS_LOOKS[info.getValue()].icon}
          label={t(`status-${info.getValue()}`)}
          tone={ROSTER_STATUS_LOOKS[info.getValue()].tone}
        />
      ),
      header: t("status"),
      id: "status",
      options: Arr.map(
        ["ready", ...RowProblem.literals] as const,
        (status) => ({
          icon: ROSTER_STATUS_LOOKS[status].icon,
          label: t(`status-${status}`),
          value: status,
        })
      ),
    }),
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      rowId={(row) => String(row.line)}
      search="name"
    />
  );
}
