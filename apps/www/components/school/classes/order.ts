import { Array as Arr, Option, Schema } from "effect";

const OrderedRowSchema = Schema.Struct({
  _id: Schema.String,
  order: Schema.Finite,
});

type OrderedRow = typeof OrderedRowSchema.Type;

/** Swap one row with its loaded neighbor while preserving server order values. */
export function reorderPage<T extends OrderedRow>(
  page: T[],
  rowId: string,
  direction: "down" | "up"
): T[] {
  const found = Arr.findFirstIndex(page, (row) => row._id === rowId);
  if (Option.isNone(found)) {
    return page;
  }
  const rowIndex = found.value;
  const neighborIndex = rowIndex + (direction === "up" ? -1 : 1);

  if (neighborIndex < 0 || neighborIndex >= page.length) {
    return page;
  }

  const row = page[rowIndex];
  const neighbor = page[neighborIndex];
  const nextPage = [...page];
  nextPage[rowIndex] = { ...neighbor, order: row.order };
  nextPage[neighborIndex] = { ...row, order: neighbor.order };
  return nextPage;
}
