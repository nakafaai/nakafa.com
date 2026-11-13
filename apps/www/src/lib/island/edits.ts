import { Array as Arr, HashSet, Schema } from "effect";
import {
  type Cells,
  CHUNK,
  CHUNKS,
  cellOf,
  HEIGHT,
  SPAN,
} from "@/lib/island/world";

/**
 * One change to one cell (ADR 0047, D6): the block it held and the block it
 * holds now, so the same record undoes itself.
 */
export const Edit = Schema.Struct({
  after: Schema.Int,
  before: Schema.Int,
  x: Schema.Int.check(Schema.isBetween({ maximum: SPAN - 1, minimum: 0 })),
  y: Schema.Int.check(Schema.isBetween({ maximum: HEIGHT - 1, minimum: 0 })),
  z: Schema.Int.check(Schema.isBetween({ maximum: SPAN - 1, minimum: 0 })),
});
export type Edit = typeof Edit.Type;

/** The same edits undone: in reverse order, each putting back what it replaced. */
export function inverseOf(edits: readonly Edit[]) {
  return Arr.map(Arr.reverse(edits), (edit) => ({
    ...edit,
    after: edit.before,
    before: edit.after,
  }));
}

/**
 * The chunks a change to (x, z) redraws: its own, and the neighbour across any
 * edge it touches, whose faces and shadows it changes too.
 */
export function chunksAround(x: number, z: number) {
  const cx = Math.floor(x / CHUNK);
  const cz = Math.floor(z / CHUNK);
  const reach = (cell: number, chunk: number): readonly number[] => {
    const local = cell - chunk * CHUNK;
    if (local === 0) {
      return [chunk - 1, chunk];
    }
    return local === CHUNK - 1 ? [chunk, chunk + 1] : [chunk];
  };
  const inside = (chunk: number) => chunk >= 0 && chunk < CHUNKS;
  const columns: readonly number[] = Arr.filter(reach(x, cx), inside);
  const rows: readonly number[] = Arr.filter(reach(z, cz), inside);
  return Arr.flatMap(columns, (column) =>
    Arr.map(rows, (row) => row * CHUNKS + column)
  );
}

/** Writes each edit's new block into the world, and answers the chunks to redraw. */
export function applyEdits(cells: Cells, edits: readonly Edit[]) {
  for (const edit of edits) {
    cells[cellOf(edit.x, edit.y, edit.z)] = edit.after;
  }
  return HashSet.fromIterable(
    Arr.flatMap(edits, (edit) => chunksAround(edit.x, edit.z))
  );
}
