import type { CellData, RowData, TableFeatures } from "@tanstack/react-table";
import type { HeadFilter } from "@/components/shared/table/columns";

declare module "@tanstack/react-table" {
  /**
   * How a Nakafa data table lays out one column and filters by it (`tableColumns`). The table places its columns as
   * the try-out tables do, the first at the start and every other in the middle; the row's menu says so, and stands at
   * the table's end edge, where it stays while a wide table scrolls, and a last column of figures says so to end on the
   * table's inset.
   */
  interface ColumnMeta<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    TValue extends CellData = CellData,
  > {
    readonly align?: "end" | "figure" | "menu";
    /** What the column's head filters the rows by. */
    readonly filter?: HeadFilter;
    /** Whether a row's menu does not answer yet, such as a row the server has not confirmed. */
    readonly inert?: (row: TData) => boolean;
    /** The column's name, which its head says it filters by. */
    readonly title?: string;
  }
}
