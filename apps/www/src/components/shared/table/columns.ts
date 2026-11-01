import type { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type {
  AccessorFn,
  CellContext,
  CellData,
  ColumnDefTemplate,
  ColumnHelper,
  RowData,
} from "@tanstack/react-table";
import type { ComponentProps } from "react";
import { withinDays } from "@/components/shared/table/days";
import type { dataTableFeatures } from "@/components/shared/table/features";

/**
 * One value a column filters by: its label, and its icon, which fits the value and which no other value of the column
 * draws. A value holds a function's data (the icon), so it is a plain shape.
 */
export interface ColumnOption {
  readonly icon: ComponentProps<typeof HugeIcons>["icon"];
  readonly label: string;
  readonly value: string;
}

/**
 * What a column's head filters the rows by: its text, its numbers, the days of its moments, or the values it holds, any
 * number of them or, for a list the server filters by one value, a single one (`ColumnChoice`).
 */
export type HeadFilter =
  | { readonly kind: "days" }
  | { readonly kind: "number" }
  | { readonly kind: "text" }
  | { readonly kind: "choice"; readonly options: readonly ColumnOption[] }
  | { readonly kind: "values"; readonly options: readonly ColumnOption[] };

/** What every column of data declares: its ID, its name in the head, how its cell draws, and where it stands. */
interface ColumnSpec<TData extends RowData, TValue extends CellData> {
  readonly align?: "end" | "figure";
  readonly cell?: ColumnDefTemplate<
    CellContext<typeof dataTableFeatures, TData, TValue>
  >;
  readonly header: string;
  readonly id: string;
}

/** A column that filters by its values: `options` hold every value its head offers. */
interface ValuesSpec<TData extends RowData, TValue extends CellData>
  extends ColumnSpec<TData, TValue> {
  readonly options: readonly ColumnOption[];
}

/** A column of moments: `timeZone` names the clock its cell prints a row's moment by. */
interface DaysSpec<TData extends RowData, TValue extends number | null>
  extends ColumnSpec<TData, TValue> {
  readonly timeZone: (row: TData) => string;
}

/** One column of any value, as TanStack Table's own helper types a table's columns. */
type AnyColumn<TData extends RowData> = ReturnType<
  ColumnHelper<typeof dataTableFeatures, TData>["columns"]
>[number];

/**
 * A column of a `DataTable`. Every column of data carries the filter of its head, and the only column without one is
 * the row's menu, so a column that nothing filters by does not reach a table: only `tableColumns` declares one.
 */
export type TableColumn<TData extends RowData> = AnyColumn<TData> & {
  readonly meta:
    | { readonly align: "menu" }
    | { readonly filter: HeadFilter; readonly title: string };
};

/** The part every column of data shares: how it reads a row, draws its cell, and names its head. */
function dataColumn<TData extends RowData, TValue extends CellData>(
  read: AccessorFn<TData, TValue>,
  { align, cell, header, id }: ColumnSpec<TData, TValue>,
  filter: HeadFilter
) {
  return {
    accessorFn: read,
    header,
    id,
    meta: { filter, title: header, ...(align === undefined ? {} : { align }) },
    ...(cell === undefined ? {} : { cell }),
  };
}

/**
 * Declares the columns of a table of `TData`, one kind of column for each kind of data, so a column's head filters what
 * the column holds: text by a field, numbers by a lowest and a highest value, moments by a range of days, and a column of
 * known values by those values. The rows sort by a column of text, numbers or moments.
 */
export const tableColumns = <TData extends RowData>() => ({
  /** A column of one value out of `options`, of a list the server filters by one value at a time. */
  choice: <TValue extends string>(
    read: AccessorFn<TData, TValue>,
    { options, ...column }: ValuesSpec<TData, TValue>
  ): TableColumn<TData> => ({
    ...dataColumn(read, column, { kind: "choice", options }),
    enableSorting: false,
    filterFn: "oneOf",
  }),
  /** A column of moments, a row without one reading as nothing. */
  days: <TValue extends number | null>(
    read: AccessorFn<TData, TValue>,
    { timeZone, ...column }: DaysSpec<TData, TValue>
  ): TableColumn<TData> => ({
    ...dataColumn(read, column, { kind: "days" }),
    filterFn: withinDays(timeZone),
    sortFn: "basic",
  }),
  /** A column whose cell holds a list of values, such as a member's roles. */
  list: <TValue extends readonly string[]>(
    read: AccessorFn<TData, TValue>,
    { options, ...column }: ValuesSpec<TData, TValue>
  ): TableColumn<TData> => ({
    ...dataColumn(read, column, { kind: "values", options }),
    enableSorting: false,
    filterFn: "anyOf",
  }),
  /** The row's menu, which holds no data, so it is the one column with nothing to filter by. */
  menu: (
    cell: ColumnDefTemplate<
      CellContext<typeof dataTableFeatures, TData, unknown>
    >
  ): TableColumn<TData> => ({ cell, id: "actions", meta: { align: "menu" } }),
  /** A column of numbers, a row without one reading as nothing. */
  number: <TValue extends number | null>(
    read: AccessorFn<TData, TValue>,
    column: ColumnSpec<TData, TValue>
  ): TableColumn<TData> => ({
    ...dataColumn(read, column, { kind: "number" }),
    filterFn: "inRange",
    sortFn: "basic",
  }),
  /** A column of free text. */
  text: <TValue extends string>(
    read: AccessorFn<TData, TValue>,
    column: ColumnSpec<TData, TValue>
  ): TableColumn<TData> => ({
    ...dataColumn(read, column, { kind: "text" }),
    filterFn: "holdsText",
    sortFn: "text",
  }),
  /** A column of one value out of `options`, such as a status. */
  values: <TValue extends string>(
    read: AccessorFn<TData, TValue>,
    { options, ...column }: ValuesSpec<TData, TValue>
  ): TableColumn<TData> => ({
    ...dataColumn(read, column, { kind: "values", options }),
    enableSorting: false,
    filterFn: "oneOf",
  }),
});
