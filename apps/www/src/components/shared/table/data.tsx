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
import { Array as Arr, Record as Rec } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { dataTableFeatures } from "@/components/shared/table/features";
import { useTableFilters } from "@/components/shared/table/toolbar";
import { EmptyNina } from "@/components/state/empty";

/** The arrow of a column sorted each way. */
const sortIcons = { asc: ArrowUp01Icon, desc: ArrowDown01Icon };

/**
 * A data table as the whole body of its page, as shadcn builds the table on TanStack Table: every row at full width,
 * from edge to edge. The page's header row filters it: its search box keeps the rows whose `search` column holds the
 * text, and its Filter menu keeps the rows whose columns hold a chosen value (`TableFiltersProvider`). A sortable
 * column sorts from its head. Every row has the height of a row with its three-dot menu, so rows with and
 * without one keep one rhythm. A filter that leaves no row shows Nina searching in the table's place.
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
    <Table containerClassName="[&_[data-slot=table-cell]]:whitespace-nowrap">
      <TableHeader>
        {Arr.map(table.getHeaderGroups(), (group) => (
          <TableRow key={group.id}>
            {Arr.map(group.headers, (header) => (
              <TableHead key={header.id}>
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
            <TableRow className="h-12" key={row.id}>
              {Arr.map(row.getAllCells(), (cell) => (
                <TableCell key={cell.id}>
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
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
      className="-ms-3"
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
