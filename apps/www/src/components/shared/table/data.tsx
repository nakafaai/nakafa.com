import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { type Cell, type RowData, useTable } from "@tanstack/react-table";
import { Array as Arr, Option } from "effect";
import { type ReactNode, use, useState } from "react";
import { useTranslations } from "use-intl";
import { PaneTableRow } from "@/components/shared/page/pane";
import { useHasPanes } from "@/components/shared/page/panes";
import { pressesRow } from "@/components/shared/row";
import { columnAlign, placeOf } from "@/components/shared/table/align";
import { tableBoxVariants } from "@/components/shared/table/card";
import type {
  HeadFilter,
  TableColumn,
} from "@/components/shared/table/columns";
import { dataTableFeatures } from "@/components/shared/table/features";
import { columnFiltersOf } from "@/components/shared/table/filter";
import { DataTableHead } from "@/components/shared/table/heading";
import { RowMenu } from "@/components/shared/table/menu";
import { ColumnHeads } from "@/components/shared/table/panel";
import {
  RemoteChoiceContext,
  type RemoteList,
  remoteSorting,
} from "@/components/shared/table/remote";
import {
  TableLead,
  TableText,
  TableValue,
} from "@/components/shared/table/text";
import {
  useNeedsEveryRow,
  useTableFilters,
} from "@/components/shared/table/toolbar";
import { TableWaitingContext } from "@/components/shared/table/waiting";
import { EmptyState } from "@/components/state/empty";
import { EmptyNina } from "@/components/state/nina";

/** The link of a row's first column, which is the row's primary action. */
const ROW_LINK = "td:first-child a[href]";

/**
 * A data table, as shadcn builds the table on TanStack Table, and the one way Nakafa draws a list of records: as the
 * whole body of its page (`PageList`), every row at full width from edge to edge of the page's card and a table
 * taller than the card scrolling inside it with its column heads in view, or as a part of a page (`TableFrame`). The
 * page's header row searches it: its search box keeps the rows whose `search` column holds the text. Every column
 * filters from its head by what it holds (`tableColumns`), and a column of text, numbers or moments sorts from there
 * too. Every row ends in its three-dot menu, the one action of a row, which the table draws itself around what the
 * menu column gives it (`RowItems`), so a table cannot put a text button in a row. The heads are true before the rows
 * are read, so they stand from the first frame and the rows fill in under them. A list that holds no record shows its `empty` state under the heads, and a filter that leaves no row shows Nina searching in
 * the rows' place. On a page with panes, pressing a row opens it beside the list. A column's meta places its head and
 * cells: a column of badges in the middle, a column of numbers or the row's menu at the end. A list that the server sorts,
 * filters and reads a window at a time, as the try-out catalog does, gives `server`.
 */
export function DataTable<TData extends RowData>({
  children,
  columns,
  data,
  empty,
  loading = false,
  pageSize,
  plain = false,
  rowId,
  search,
  server,
}: {
  /** The rows under the body, such as a footer of totals. */
  children?: ReactNode;
  columns: readonly TableColumn<TData>[];
  data: readonly TData[];
  /** What the list says once it is read and holds no record. */
  empty?: ReactNode;
  /** Whether more rows may still arrive, so a table with no row waits for them before it says it found none. */
  loading?: boolean;
  /** How many rows to draw at a time for a list held whole in memory, more as the end comes near. */
  pageSize?: number;
  /** Whether a row stays a plain row on a page with panes, as a table inside an open pane's rows do. */
  plain?: boolean;
  rowId: (row: TData) => string;
  /** The column that the header's search box filters by its text, when the page has one. */
  search?: string;
  /** A list the server sorts, filters and reads a window at a time (`RemoteList`). */
  server?: RemoteList;
}) {
  const t = useTranslations("DataTable");
  const hasPanes = useHasPanes();
  const text = useTableFilters((state) => state.search);
  const chosen = useTableFilters((state) => state.chosen);
  const sorting = remoteSorting(server);
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const table = useTable({
    columns,
    data,
    features: dataTableFeatures,
    getRowId: rowId,
    ...sorting.options,
    state: {
      columnFilters: columnFiltersOf(chosen, search, text),
      ...sorting.state,
    },
  });
  const rows = table.getRowModel().rows;
  const [drawn, setDrawn] = useState(pageSize ?? rows.length);
  const shown = pageSize === undefined ? rows : Arr.take(rows, drawn);
  const waiting = use(TableWaitingContext) || loading;
  const chooses = useNeedsEveryRow();
  const isBare = Arr.isReadonlyArrayEmpty(data);
  const showsEmpty =
    isBare && !waiting && empty !== undefined && text.trim() === "";

  return (
    <RemoteChoiceContext value={server}>
      <Table
        aria-busy={waiting}
        containerClassName={tableBoxVariants({
          closes: !isBare,
          fills: !showsEmpty,
        })}
        viewportRef={setViewport}
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
          {Arr.isReadonlyArrayNonEmpty(rows) ||
          (waiting && !chooses) ||
          showsEmpty ? (
            Arr.map(shown, (row) => (
              <DataTableRow key={row.id} opens={hasPanes && !plain} row={row}>
                {Arr.map(row.getAllCells(), (cell, index) => (
                  <DataTableCell cell={cell} index={index} key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </DataTableCell>
                ))}
              </DataTableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length}>
                <EmptyState
                  frame="table"
                  scene={<EmptyNina act="searching" />}
                  title={t(waiting ? "searching" : "no-results")}
                />
              </TableCell>
            </TableRow>
          )}
          <RemoteEnd
            colSpan={columns.length}
            count={data.length}
            list={server}
            root={viewport}
          />
        </TableBody>
        {children}
      </Table>
      {showsEmpty ? empty : null}
      {pageSize !== undefined && drawn < rows.length ? (
        <Intersection
          key={drawn}
          onIntersect={() => setDrawn(drawn + pageSize)}
        />
      ) : null}
    </RemoteChoiceContext>
  );
}

/**
 * The end of the rows of a remote list: a row of one pixel that reads the next window as it comes near inside the
 * table's own scroll, so a short list, such as a filtered one, keeps reading until it fills the table or the list ends.
 * It mounts again for each answer and each window, so a window that leaves it in view reads the next one.
 */
function RemoteEnd({
  colSpan,
  count,
  list,
  root,
}: {
  colSpan: number;
  /** How many rows the list holds, which names each window. */
  count: number;
  /** The list, when the server reads it a window at a time. */
  list: RemoteList | undefined;
  root: HTMLDivElement | null;
}) {
  return Option.match(
    Option.flatMap(Option.fromNullishOr(list), (remote) => remote.more),
    {
      onNone: () => null,
      onSome: (more) => (
        <TableRow aria-hidden="true" className="h-px">
          <TableCell className="p-0" colSpan={colSpan}>
            <Intersection
              className="h-px"
              key={`${list?.snapshot}:${count}`}
              onIntersect={more}
              root={root}
            />
          </TableCell>
        </TableRow>
      ),
    }
  );
}

/** One cell of a row, in its column's place, with the row's menu around what the menu column holds. */
function DataTableCell<TData extends RowData>({
  cell,
  children,
  index,
}: {
  cell: Cell<typeof dataTableFeatures, TData>;
  children: ReactNode;
  index: number;
}) {
  const { meta } = cell.column.columnDef;

  return (
    <TableCell className={columnAlign({ align: placeOf(index, meta?.align) })}>
      {meta?.align === "menu" ? (
        <RowMenu inert={meta.inert?.(cell.row.original)}>{children}</RowMenu>
      ) : (
        <DataTableValue filter={meta?.filter} first={index === 0}>
          {children}
        </DataTableValue>
      )}
    </TableCell>
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
 * What a cell holds, inside the width its column keeps, so no row can move a head: known values wrap in their column,
 * a later column of text holds the longest value it reads, and the first column of text adds no width at all.
 */
function DataTableValue({
  children,
  filter,
  first,
}: {
  children: ReactNode;
  /** What the cell's column filters by. */
  filter: HeadFilter | undefined;
  /** Whether the cell stands in the table's first column. */
  first: boolean;
}) {
  if (filter?.kind === "text") {
    return first ? (
      <TableLead>{children}</TableLead>
    ) : (
      <TableText>{children}</TableText>
    );
  }
  return filter?.kind === "choice" || filter?.kind === "values" ? (
    <TableValue>{children}</TableValue>
  ) : (
    children
  );
}
