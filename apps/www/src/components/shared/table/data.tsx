import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  ArrowUpDownIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import {
  type ColumnDef,
  type Header,
  type RowData,
  useTable,
} from "@tanstack/react-table";
import { cva } from "class-variance-authority";
import { Array as Arr, Record as Rec } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { PaneTableRow } from "@/components/shared/pane";
import { useHasPanes } from "@/components/shared/panes";
import { dataTableFeatures } from "@/components/shared/table/features";
import { useTableFilters } from "@/components/shared/table/toolbar";
import { EmptyNina } from "@/components/state/empty";

/** The arrow of a column sorted each way. */
const sortIcons = { asc: ArrowUp01Icon, desc: ArrowDown01Icon };

/** Where a column's head and cells stand, as its meta says: at the start, in the middle for badges, or at the end. */
const columnAlign = cva("", {
  defaultVariants: { align: "start" },
  variants: {
    align: { center: "text-center", end: "text-end", start: "" },
  },
});

/** The sort button of a column's head, pulled to the column's edge so its name lines up with the cells below. */
const sortButton = cva("", {
  defaultVariants: { align: "start" },
  variants: {
    align: { center: "", end: "-me-3", start: "-ms-3" },
  },
});

/**
 * A data table as the whole body of its page, as shadcn builds the table on TanStack Table: every row at full width,
 * from edge to edge of the page's card (`TablePageBody`), and a table taller than the card scrolls inside it with its
 * column heads in view. The page's header row searches it: its search box keeps the rows whose `search` column holds
 * the text, and a column's filter keeps the rows whose column holds a chosen value (`TableFiltersProvider`). A sortable
 * column sorts from its head. Every row has the height of a row with its three-dot menu, so rows with and
 * without one keep one rhythm. A filter that leaves no row shows Nina searching in the table's place. On a page
 * with panes, pressing a row opens it beside the list. A column's meta places its head and cells: a column of badges
 * in the middle, a column of numbers or the row's menu at the end; a column that filters by its values holds its
 * filter in its head (`ColumnFilter`).
 */
export function DataTable<TData extends RowData>({
  columns,
  data,
  rowId,
  search,
}: {
  columns: readonly ColumnDef<typeof dataTableFeatures, TData>[];
  data: readonly TData[];
  rowId: (row: TData) => string;
  /** The column that the header's search box filters by its text. */
  search: string;
}) {
  const t = useTranslations("DataTable");
  const text = useTableFilters((state) => state.search);
  const chosen = useTableFilters((state) => state.chosen);
  const table = useTable({
    columns,
    data,
    features: dataTableFeatures,
    getRowId: rowId,
    state: {
      columnFilters: [
        ...(text === "" ? [] : [{ id: search, value: text }]),
        ...Arr.map(
          Arr.filter(Rec.toEntries(chosen), ([, values]) =>
            Arr.isReadonlyArrayNonEmpty(values)
          ),
          ([id, value]) => ({ id, value })
        ),
      ],
    },
  });
  const rows = table.getRowModel().rows;

  return (
    <Table containerClassName="flex-1 [&_[data-slot=table-cell]]:whitespace-nowrap [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-card">
      <TableHeader>
        {Arr.map(table.getHeaderGroups(), (group) => (
          <TableRow key={group.id}>
            {Arr.map(group.headers, (header) => (
              <TableHead
                className={columnAlign({
                  align: header.column.columnDef.meta?.align,
                })}
                key={header.id}
              >
                {header.isPlaceholder ? null : (
                  <DataTableHead header={header}>
                    <table.FlexRender header={header} />
                  </DataTableHead>
                )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {Arr.isReadonlyArrayNonEmpty(rows) ? (
          Arr.map(rows, (row) => (
            <DataTableRow key={row.id} row={row}>
              {Arr.map(row.getAllCells(), (cell) => (
                <TableCell
                  className={columnAlign({
                    align: cell.column.columnDef.meta?.align,
                  })}
                  key={cell.id}
                >
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </DataTableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={columns.length}>
              <Empty className="p-6 md:p-6">
                <EmptyHeader>
                  <EmptyNina act="searching" />
                  <EmptyTitle className="text-base">
                    {t("no-results")}
                  </EmptyTitle>
                </EmptyHeader>
              </Empty>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

/** One row of the table: a row that opens beside the list on a page with panes, else a plain row. */
function DataTableRow({
  children,
  row,
}: {
  children: ReactNode;
  row: { readonly id: string };
}) {
  const hasPanes = useHasPanes();

  return hasPanes ? (
    <PaneTableRow id={row.id}>{children}</PaneTableRow>
  ) : (
    <TableRow className="h-12">{children}</TableRow>
  );
}

/** A column's head: a button that sorts by the column when the column sorts, else its name. */
function DataTableHead<TData extends RowData>({
  children,
  header,
}: {
  children: ReactNode;
  header: Header<typeof dataTableFeatures, TData>;
}) {
  const column = header.column;
  if (!column.getCanSort()) {
    return children;
  }
  const sorted = column.getIsSorted();

  return (
    <Button
      className={sortButton({ align: column.columnDef.meta?.align })}
      onClick={column.getToggleSortingHandler()}
      size="sm"
      type="button"
      variant="ghost"
    >
      {children}
      <HugeIcons
        icon={sorted === false ? ArrowUpDownIcon : sortIcons[sorted]}
      />
    </Button>
  );
}
