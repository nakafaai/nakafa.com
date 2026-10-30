import {
  ArrowDown02Icon,
  ArrowUp02Icon,
  ArrowUpDownIcon,
} from "@hugeicons/core-free-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
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
import { TableHeadButton } from "@/components/shared/table/head";
import { useTableFilters } from "@/components/shared/table/toolbar";
import { EmptyNina } from "@/components/state/empty";

/** The arrow of a column's head while it sorts the rows each way, and while it sorts none. */
const sortIcons = {
  asc: ArrowUp02Icon,
  desc: ArrowDown02Icon,
  none: ArrowUpDownIcon,
};

/** How a column's head names the way it sorts the rows, for assistive technology. */
const sortNames = {
  asc: "ascending",
  desc: "descending",
  none: "none",
} as const;

/**
 * Where a column's head and cells stand, as the try-out tables place them: the first column, which names the row, at
 * the start, and every other column in the middle, its figures in digits of one width. The row's menu stands at the
 * end and stays at the table's end edge on the row's background while a table wider than the phone scrolls under it,
 * so every row's actions stay in reach.
 */
const columnAlign = cva("px-2 sm:px-4", {
  defaultVariants: { align: "center" },
  variants: {
    align: {
      center: "text-center tabular-nums",
      menu: "sticky end-0 bg-card in-[tr[data-pressable]:hover]:bg-accent in-aria-selected:bg-accent text-end",
      start: "",
    },
  },
});

/** The place of a column in its table: the first names the row, the menu acts on it, and the rest stand between. */
const placeOf = (index: number, menu: boolean) => {
  if (menu) {
    return "menu";
  }
  return index === 0 ? "start" : "center";
};

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
    <Table containerClassName="min-h-0 flex-1 content-start overflow-auto [&_[data-slot=table-cell]]:whitespace-nowrap [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-card">
      <TableHeader>
        {Arr.map(table.getHeaderGroups(), (group) => (
          <TableRow
            className="hover:bg-transparent hover:text-inherit"
            key={group.id}
          >
            {Arr.map(group.headers, (header, index) => (
              <DataTableHead header={header} index={index} key={header.id}>
                <table.FlexRender header={header} />
              </DataTableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {Arr.isReadonlyArrayNonEmpty(rows) ? (
          Arr.map(rows, (row) => (
            <DataTableRow key={row.id} row={row}>
              {Arr.map(row.getAllCells(), (cell, index) => (
                <TableCell
                  className={columnAlign({
                    align: placeOf(
                      index,
                      cell.column.columnDef.meta?.align === "menu"
                    ),
                  })}
                  key={cell.id}
                >
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </DataTableRow>
          ))
        ) : (
          <TableRow className="hover:bg-transparent hover:text-inherit">
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

/**
 * One row of the table: a row that opens beside the list on a page with panes, which lights under the pointer as the
 * whole row is pressable, else a plain row that does not, since pressing it opens nothing.
 */
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
    <TableRow className="h-12 hover:bg-transparent hover:text-inherit">
      {children}
    </TableRow>
  );
}

/**
 * A column's head, in its place in the line: the column's name, or, when the column sorts the rows, the head's button
 * whose menu sorts them each way, as the try-out tables' heads do. A column that filters draws its own button in its
 * head (`ColumnFilter`).
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
  const t = useTranslations("DataTable");
  const column = header.column;
  const place = placeOf(index, column.columnDef.meta?.align === "menu");
  const sorted = column.getIsSorted() || "none";

  if (header.isPlaceholder) {
    return <TableHead className={columnAlign({ align: place })} />;
  }
  if (!column.getCanSort()) {
    return (
      <TableHead className={columnAlign({ align: place })} scope="col">
        {children}
      </TableHead>
    );
  }
  return (
    <TableHead
      aria-sort={sortNames[sorted]}
      className={columnAlign({ align: place })}
      scope="col"
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <TableHeadButton
              active={sorted !== "none"}
              align={place === "start" ? "start" : "center"}
              icon={sortIcons[sorted]}
            >
              {children}
            </TableHeadButton>
          }
        />
        <DropdownMenuContent align="start" className="w-max">
          <DropdownMenuGroup>
            <DropdownMenuRadioGroup
              onValueChange={(next) => {
                if (next === "asc" || next === "desc") {
                  column.toggleSorting(next === "desc");
                }
              }}
              value={sorted === "none" ? "" : sorted}
            >
              <DropdownMenuRadioItem value="asc">
                <HugeIcons icon={ArrowUp02Icon} />
                {t("sort-ascending")}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="desc">
                <HugeIcons icon={ArrowDown02Icon} />
                {t("sort-descending")}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </TableHead>
  );
}
