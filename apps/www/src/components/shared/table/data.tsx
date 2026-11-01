import {
  ArrowDown02Icon,
  ArrowUp02Icon,
  Calendar03Icon,
  FilterIcon,
} from "@hugeicons/core-free-icons";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { type Header, type RowData, useTable } from "@tanstack/react-table";
import { Array as Arr, Match } from "effect";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { PaneTableRow } from "@/components/shared/pane";
import { useHasPanes } from "@/components/shared/panes";
import {
  columnAlign,
  HeadAlignContext,
  headPlace,
  placeOf,
} from "@/components/shared/table/align";
import { HeadDays } from "@/components/shared/table/calendar";
import { ColumnChoice, ColumnFilter } from "@/components/shared/table/column";
import type {
  HeadFilter,
  TableColumn,
} from "@/components/shared/table/columns";
import { dataTableFeatures } from "@/components/shared/table/features";
import { columnFiltersOf } from "@/components/shared/table/filter";
import { TableHeadButton } from "@/components/shared/table/head";
import {
  ColumnHead,
  HeadPanel,
  HeadRange,
  HeadReset,
  HeadSort,
  HeadText,
  useIsFiltered,
} from "@/components/shared/table/panel";
import { useTableFilters } from "@/components/shared/table/toolbar";
import { EmptyNina } from "@/components/state/empty";

/** The arrow of a column's head while it sorts the rows each way. */
const sortIcons = { asc: ArrowUp02Icon, desc: ArrowDown02Icon };

/**
 * A data table, as shadcn builds the table on TanStack Table, and the one way Nakafa draws a list of records: as the
 * whole body of its page (`TablePageBody`), every row at full width from edge to edge of the page's card and a table
 * taller than the card scrolling inside it with its column heads in view, or as a part of a page (`TableFrame`). The
 * page's header row searches it: its search box keeps the rows whose `search` column holds the text. Every column
 * filters from its head by what it holds (`tableColumns`), and a column of text, numbers or moments sorts from there
 * too. Every row has the height of a row with its three-dot menu, so rows with and without one keep one rhythm. A
 * filter that leaves no row shows Nina searching in the table's place. On a page with panes, pressing a row opens it
 * beside the list. A column's meta places its head and cells: a column of badges in the middle, a column of numbers or
 * the row's menu at the end.
 */
export function DataTable<TData extends RowData>({
  children,
  columns,
  data,
  loading = false,
  plain = false,
  rowId,
  search,
}: {
  /** The rows under the body, such as a footer of totals. */
  children?: ReactNode;
  columns: readonly TableColumn<TData>[];
  data: readonly TData[];
  /** Whether more rows may still arrive, so a table with no row waits for them before it says it found none. */
  loading?: boolean;
  /** Whether a row stays a plain row on a page with panes, as a table inside an open pane's rows do. */
  plain?: boolean;
  rowId: (row: TData) => string;
  /** The column that the header's search box filters by its text, when the page has one. */
  search?: string;
}) {
  const t = useTranslations("DataTable");
  const text = useTableFilters((state) => state.search);
  const chosen = useTableFilters((state) => state.chosen);
  const table = useTable({
    columns,
    data,
    features: dataTableFeatures,
    getRowId: rowId,
    state: { columnFilters: columnFiltersOf(chosen, search, text) },
  });
  const rows = table.getRowModel().rows;

  return (
    <Table
      aria-busy={loading}
      containerClassName="flex-1 [&_[data-slot=table-cell]]:whitespace-nowrap [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-card"
    >
      <TableHeader>
        {Arr.map(table.getHeaderGroups(), (group) => (
          <TableRow key={group.id}>
            {Arr.map(group.headers, (header, index) => (
              <DataTableHead header={header} index={index} key={header.id}>
                <table.FlexRender header={header} />
              </DataTableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {Arr.isReadonlyArrayNonEmpty(rows) || loading ? (
          Arr.map(rows, (row) => (
            <DataTableRow key={row.id} plain={plain} row={row}>
              {Arr.map(row.getAllCells(), (cell, index) => (
                <TableCell
                  className={columnAlign({
                    align: placeOf(index, cell.column.columnDef.meta?.align),
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
      {children}
    </Table>
  );
}

/** One row of the table: a row that opens beside the list on a page with panes, else a plain row. */
function DataTableRow({
  children,
  plain,
  row,
}: {
  children: ReactNode;
  plain: boolean;
  row: { readonly id: string };
}) {
  const hasPanes = useHasPanes();

  return hasPanes && !plain ? (
    <PaneTableRow id={row.id}>{children}</PaneTableRow>
  ) : (
    <TableRow className="h-12">{children}</TableRow>
  );
}

/**
 * A column's head, in its place in the line: the button that opens what filters the column, or nothing over the row's
 * menu, the one column with nothing to filter by.
 */
function DataTableHead<TData extends RowData>({
  children,
  header,
  index,
}: {
  children: ReactNode;
  header: Header<typeof dataTableFeatures, TData>;
  index: number;
}) {
  const column = header.column;
  const { align, filter, title = "" } = column.columnDef.meta ?? {};
  const place = placeOf(index, align);

  if (header.isPlaceholder || filter === undefined) {
    return <ColumnHead place={place} />;
  }
  return (
    <ColumnHead place={place} sorted={column.getIsSorted() || "none"}>
      <HeadAlignContext value={headPlace[place]}>
        <HeadControl filter={filter} header={header} title={title}>
          {children}
        </HeadControl>
      </HeadAlignContext>
    </ColumnHead>
  );
}

/** What a head holds: a menu of the values a column holds, or the panel of a column of text, numbers or moments. */
function HeadControl<TData extends RowData>({
  children,
  filter,
  header,
  title,
}: {
  children: ReactNode;
  filter: HeadFilter;
  header: Header<typeof dataTableFeatures, TData>;
  title: string;
}) {
  const id = header.column.id;

  return Match.value(filter).pipe(
    Match.discriminatorsExhaustive("kind")({
      choice: ({ options }) => (
        <ColumnChoice column={id} options={options} title={title} />
      ),
      days: () => (
        <SortingHead header={header} icon={Calendar03Icon} name={children}>
          <HeadDays column={id} />
        </SortingHead>
      ),
      number: () => (
        <SortingHead header={header} icon={FilterIcon} name={children}>
          <HeadRange column={id} label={title} />
        </SortingHead>
      ),
      text: () => (
        <SortingHead header={header} icon={FilterIcon} name={children}>
          <HeadText column={id} label={title} />
        </SortingHead>
      ),
      values: ({ options }) => (
        <ColumnFilter column={id} options={options} title={title} />
      ),
    })
  );
}

/**
 * The head of a column that sorts the rows: its button, which shows the way the rows sort or that the column filters
 * them, and the panel that sorts them each way above what filters the column (`children`).
 */
function SortingHead<TData extends RowData>({
  children,
  header,
  icon,
  name,
}: {
  children: ReactNode;
  header: Header<typeof dataTableFeatures, TData>;
  /** The icon of a head that neither sorts nor filters yet. */
  icon: typeof FilterIcon;
  name: ReactNode;
}) {
  const t = useTranslations("DataTable");
  const column = header.column;
  const sorted = column.getIsSorted() || "none";
  const filtered = useIsFiltered(column.id);

  return (
    <HeadPanel
      trigger={
        <TableHeadButton
          active={sorted !== "none" || filtered}
          icon={sorted === "none" ? icon : sortIcons[sorted]}
        >
          {name}
        </TableHeadButton>
      }
    >
      <HeadSort
        ascending={t("sort-ascending")}
        descending={t("sort-descending")}
        onSort={(descending) => column.toggleSorting(descending)}
        sorted={sorted}
      />
      {children}
      <HeadReset column={column.id} />
    </HeadPanel>
  );
}
