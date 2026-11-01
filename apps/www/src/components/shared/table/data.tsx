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
  TableRow,
} from "@repo/design-system/components/ui/table";
import { type Header, type RowData, useTable } from "@tanstack/react-table";
import { Array as Arr, Match, Option } from "effect";
import { type ComponentProps, type ReactNode, use } from "react";
import { useTranslations } from "use-intl";
import { PaneTableRow } from "@/components/shared/pane";
import { useHasPanes } from "@/components/shared/panes";
import { pressesRow } from "@/components/shared/row";
import {
  columnAlign,
  HeadAlignContext,
  headPlace,
  menuPlaceOf,
  placeOf,
} from "@/components/shared/table/align";
import { HeadDays } from "@/components/shared/table/calendar";
import { tableBoxVariants } from "@/components/shared/table/card";
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
  ColumnHeads,
  HeadPanel,
  HeadRange,
  HeadReset,
  HeadSort,
  HeadText,
  useIsFiltered,
} from "@/components/shared/table/panel";
import { useTableFilters } from "@/components/shared/table/toolbar";
import { TableWaitingContext } from "@/components/shared/table/waiting";
import { EmptyNina } from "@/components/state/empty";

/** The link of a row's first column, which is the row's primary action. */
const ROW_LINK = "td:first-child a[href]";

/** The arrow of a column's head while it sorts the rows each way. */
const sortIcons = { asc: ArrowUp02Icon, desc: ArrowDown02Icon };

/**
 * A data table, as shadcn builds the table on TanStack Table, and the one way Nakafa draws a list of records: as the
 * whole body of its page (`TablePageBody`), every row at full width from edge to edge of the page's card and a table
 * taller than the card scrolling inside it with its column heads in view, or as a part of a page (`TableFrame`). The
 * page's header row searches it: its search box keeps the rows whose `search` column holds the text. Every column
 * filters from its head by what it holds (`tableColumns`), and a column of text, numbers or moments sorts from there
 * too. Every row has the height of a row with its three-dot menu, so rows with and without one keep one rhythm. The
 * heads are true before the rows are read, so they stand from the first frame and the rows fill in under them. A list
 * that holds no record shows its `empty` state under the heads, and a filter that leaves no row shows Nina searching in
 * the rows' place. On a page with panes, pressing a row opens it beside the list. A column's meta places its head and
 * cells: a column of badges in the middle, a column of numbers or the row's menu at the end.
 */
export function DataTable<TData extends RowData>({
  children,
  columns,
  data,
  empty,
  loading = false,
  plain = false,
  rowId,
  search,
}: {
  /** The rows under the body, such as a footer of totals. */
  children?: ReactNode;
  columns: readonly TableColumn<TData>[];
  data: readonly TData[];
  /** What the list says once it is read and holds no record. */
  empty?: ReactNode;
  /** Whether more rows may still arrive, so a table with no row waits for them before it says it found none. */
  loading?: boolean;
  /** Whether a row stays a plain row on a page with panes, as a table inside an open pane's rows do. */
  plain?: boolean;
  rowId: (row: TData) => string;
  /** The column that the header's search box filters by its text, when the page has one. */
  search?: string;
}) {
  const t = useTranslations("DataTable");
  const hasPanes = useHasPanes();
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
  const waiting = use(TableWaitingContext) || loading;
  const isBare = Arr.isReadonlyArrayEmpty(data);
  const showsEmpty = isBare && !waiting && empty !== undefined;

  return (
    <>
      <Table
        aria-busy={waiting}
        containerClassName={tableBoxVariants({ fills: !showsEmpty })}
        data-bare={isBare ? "" : undefined}
      >
        <ColumnHeads>
          {Arr.map(table.getHeaderGroups(), (group) => (
            <TableRow key={group.id}>
              {Arr.map(group.headers, (header, index) => (
                <DataTableHead header={header} index={index} key={header.id}>
                  <table.FlexRender header={header} />
                </DataTableHead>
              ))}
            </TableRow>
          ))}
        </ColumnHeads>
        <TableBody>
          {Arr.isReadonlyArrayNonEmpty(rows) || waiting || showsEmpty ? (
            Arr.map(rows, (row) => (
              <DataTableRow key={row.id} opens={hasPanes && !plain} row={row}>
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
      {showsEmpty ? empty : null}
    </>
  );
}

/**
 * One row of the table: a row that opens beside the list on a page with panes, else a row whose first column may hold a
 * link. Pressing such a row presses that link, which stays a real link for the keyboard and a new tab, and a row without
 * one draws no pointer.
 */
function DataTableRow({
  children,
  opens,
  row,
}: {
  children: ReactNode;
  /** Whether pressing the row opens it beside the list. */
  opens: boolean;
  row: { readonly id: string };
}) {
  return opens ? (
    <PaneTableRow id={row.id}>{children}</PaneTableRow>
  ) : (
    <TableRow
      className="has-[td:first-child_a[href]]:hover:bg-muted h-12 has-[td:first-child_a[href]]:cursor-pointer"
      data-pressable={undefined}
      onClick={(event) => {
        if (pressesRow(event)) {
          event.currentTarget
            .querySelector<HTMLAnchorElement>(ROW_LINK)
            ?.click();
        }
      }}
    >
      {children}
    </TableRow>
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
    return <ColumnHead place={place} width="menu" />;
  }
  return (
    <ColumnHead
      menu={menuPlaceOf(
        index,
        Option.getOrElse(
          Arr.findLastIndex(
            header.headerGroup?.headers ?? [],
            (head) => head.column.columnDef.meta?.filter !== undefined
          ),
          () => index
        )
      )}
      place={place}
      sorted={column.getCanSort() ? column.getIsSorted() || "none" : undefined}
      width={filter.kind}
    >
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
        <SortingHead header={header} kind="days" name={children}>
          <HeadDays column={id} />
        </SortingHead>
      ),
      number: () => (
        <SortingHead header={header} kind="number" name={children}>
          <HeadRange column={id} label={title} />
        </SortingHead>
      ),
      text: () => (
        <SortingHead header={header} kind="text" name={children}>
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
  kind,
  name,
}: {
  children: ReactNode;
  header: Header<typeof dataTableFeatures, TData>;
  kind: ComponentProps<typeof HeadSort>["kind"];
  name: ReactNode;
}) {
  const column = header.column;
  const sorted = column.getIsSorted() || "none";
  const filtered = useIsFiltered(column.id);
  const idle = kind === "days" ? Calendar03Icon : FilterIcon;

  return (
    <HeadPanel
      trigger={
        <TableHeadButton
          active={sorted !== "none" || filtered}
          icon={sorted === "none" ? idle : sortIcons[sorted]}
        >
          {name}
        </TableHeadButton>
      }
    >
      <HeadSort
        kind={kind}
        onSort={(descending) => column.toggleSorting(descending)}
        sorted={sorted}
      />
      {children}
      <HeadReset column={column.id} />
    </HeadPanel>
  );
}
