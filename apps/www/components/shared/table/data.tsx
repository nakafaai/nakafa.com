"use client";

import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  ArrowUpDownIcon,
  Cancel01Icon,
  FilterHorizontalIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@repo/design-system/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import {
  type Column,
  type ColumnDef,
  columnFacetingFeature,
  columnFilteringFeature,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  type Header,
  type RowData,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { Array as Arr, Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { FacetValues, oneOfFilter } from "@/components/shared/table/filter";
import { TableFrame } from "@/components/shared/table/frame";
import { EmptyNina } from "@/components/state/empty";

/**
 * What every Nakafa data table can do, as shadcn's data table registers it on TanStack
 * Table: filter each column, count the values a column holds, and sort.
 */
export const dataTableFeatures = tableFeatures({
  columnFacetingFeature,
  columnFilteringFeature,
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  filteredRowModel: createFilteredRowModel(),
  filterFns: {
    includesString: filterFn_includesString,
    oneOf: oneOfFilter,
  },
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
});

/** The arrow of a column sorted each way. */
const sortIcons = { asc: ArrowUp01Icon, desc: ArrowDown01Icon };

/**
 * A data table as shadcn builds it: a toolbar that filters the rows, then the table in
 * its frame, every row at full width. The search box filters one column by its text, each
 * facet filters a column by the values it holds, and a sortable column sorts from its
 * head. A filter that leaves no row shows Nina searching in the table's place.
 */
export function DataTable<TData extends RowData>({
  columns,
  data,
  facets = [],
  rowId,
  search,
}: {
  columns: readonly ColumnDef<typeof dataTableFeatures, TData>[];
  data: readonly TData[];
  /** The columns that filter by their values, each with its title and the label of each value, in order. */
  facets?: readonly {
    column: string;
    options: readonly { label: string; value: string }[];
    title: string;
  }[];
  rowId: (row: TData) => string;
  /** The column the search box filters by its text, and what the box says while empty. */
  search: { column: string; placeholder: string };
}) {
  const t = useTranslations("DataTable");
  const table = useTable({
    columns,
    data,
    features: dataTableFeatures,
    getRowId: rowId,
  });
  const searched = table.getColumn(search.column);
  const rows = table.getRowModel().rows;
  const filtered = Arr.isReadonlyArrayNonEmpty(table.state.columnFilters);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="w-full sm:max-w-xs">
          <InputGroupAddon>
            <HugeIcons icon={Search01Icon} />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={search.placeholder}
            onChange={(event) => searched?.setFilterValue(event.target.value)}
            placeholder={search.placeholder}
            value={Option.getOrElse(
              Schema.decodeUnknownOption(Schema.String)(
                searched?.getFilterValue()
              ),
              () => ""
            )}
          />
        </InputGroup>
        {Arr.map(facets, (facet) => {
          const column = table.getColumn(facet.column);
          return column === undefined ? null : (
            <DataTableFacet
              column={column}
              key={facet.column}
              options={facet.options}
              title={facet.title}
            />
          );
        })}
        {filtered ? (
          <Button
            onClick={() => table.resetColumnFilters()}
            size="sm"
            type="button"
            variant="ghost"
          >
            <HugeIcons icon={Cancel01Icon} />
            {t("reset")}
          </Button>
        ) : null}
      </div>
      <TableFrame>
        <Table>
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
                <TableRow key={row.id}>
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
      </TableFrame>
    </div>
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

/**
 * The filter of one column by the values it holds: a menu of the values present in the
 * rows, each with how many rows hold it. Choosing values keeps the rows that hold any
 * of them.
 */
function DataTableFacet<TData extends RowData>({
  column,
  options,
  title,
}: {
  column: Column<typeof dataTableFeatures, TData>;
  options: readonly { label: string; value: string }[];
  title: string;
}) {
  const counts = column.getFacetedUniqueValues();
  const chosen = Option.getOrElse(
    Schema.decodeUnknownOption(FacetValues)(column.getFilterValue()),
    () => []
  );
  const present = Arr.filter(options, (option) => counts.has(option.value));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="sm"
            type="button"
            variant={
              Arr.isReadonlyArrayNonEmpty(chosen) ? "secondary" : "outline"
            }
          >
            <HugeIcons icon={FilterHorizontalIcon} />
            {title}
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{title}</DropdownMenuLabel>
          {Arr.map(present, (option) => (
            <DropdownMenuCheckboxItem
              checked={Arr.contains(chosen, option.value)}
              closeOnClick={false}
              key={option.value}
              onCheckedChange={(next) => {
                const values = next
                  ? Arr.append(chosen, option.value)
                  : Arr.filter(chosen, (value) => value !== option.value);
                column.setFilterValue(
                  Arr.isReadonlyArrayNonEmpty(values) ? values : undefined
                );
              }}
            >
              {option.label}
              <DropdownMenuShortcut>
                {counts.get(option.value)}
              </DropdownMenuShortcut>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
