import type { CellData, RowData, TableFeatures } from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  /**
   * How a Nakafa data table lays out one column. The table places its columns as the try-out tables do, the first at
   * the start and every other in the middle; the row's menu says so, and stands at the table's end edge, where it
   * stays while a wide table scrolls, and a last column of figures says so to end on the table's inset.
   */
  interface ColumnMeta<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    TValue extends CellData = CellData,
  > {
    readonly align?: "end" | "menu";
    /** A column of moments whose head also chooses the days to keep (`DaysHead`), as well as sorting. */
    readonly filter?: "days";
  }
}
