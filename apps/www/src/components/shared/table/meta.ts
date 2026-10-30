import type { CellData, RowData, TableFeatures } from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  /**
   * How a Nakafa data table lays out one column. A column of badges stands in the middle of its cells, a column of
   * numbers or dates at their end, its head with it, and the row's menu at the table's end edge, where it stays while
   * a wide table scrolls; every other column starts at the start.
   */
  interface ColumnMeta<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    TValue extends CellData = CellData,
  > {
    readonly align?: "center" | "end" | "menu";
  }
}
