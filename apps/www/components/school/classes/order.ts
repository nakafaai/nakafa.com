interface OrderedRow {
  _id: string;
  order: number;
}

/** Swap one row with its loaded neighbor while preserving server order values. */
export function reorderPage<T extends OrderedRow>(
  page: T[],
  rowId: string,
  direction: "down" | "up"
): T[] {
  const rowIndex = page.findIndex((row) => row._id === rowId);
  const neighborIndex = rowIndex + (direction === "up" ? -1 : 1);

  if (rowIndex < 0 || neighborIndex < 0 || neighborIndex >= page.length) {
    return page;
  }

  const row = page[rowIndex];
  const neighbor = page[neighborIndex];
  const nextPage = [...page];
  nextPage[rowIndex] = { ...neighbor, order: row.order };
  nextPage[neighborIndex] = { ...row, order: neighbor.order };
  return nextPage;
}
