import {
  Array as Arr,
  Effect,
  MutableHashMap,
  Order,
  Schema,
  SchemaIssue,
  SchemaTransformation,
} from "effect";

/**
 * The island game's world (ADR 0047, D3): `SPAN` cells wide and deep, the
 * widest footprint, and `HEIGHT` cells high. A cell keeps its coordinates
 * while the island grows around the middle, so a stored edit never moves.
 */
export const SPAN = 64;

/** The cells from the sea floor to the sky. */
export const HEIGHT = 32;

/** The most cells one island may change (D6): 64 KB of edits. */
export const MAX_EDITS = 16_384;

/** The bytes of one stored edit: x, y, z and the block (D6). */
const RECORD_BYTES = 4;

const Across = Schema.Int.check(
  Schema.isBetween({ maximum: SPAN - 1, minimum: 0 })
);

/**
 * One cell the learner changed and the block it holds now, 0 for a cell they
 * emptied. A block id is checked against the catalog where it is built.
 */
export const Edit = Schema.Struct({
  block: Schema.Int.check(Schema.isBetween({ maximum: 255, minimum: 0 })),
  x: Across,
  y: Schema.Int.check(Schema.isBetween({ maximum: HEIGHT - 1, minimum: 0 })),
  z: Across,
});
export type Edit = typeof Edit.Type;

/** The place of a cell in the world's order: layers of y, then rows of z, then x. */
export function cellKeyOf(edit: Pick<Edit, "x" | "y" | "z">) {
  return (edit.y * SPAN + edit.z) * SPAN + edit.x;
}

/** Reads the records of packed edits; their length is checked first. `makeBy` makes at least one, so no edits read as none. */
function readRecords(view: DataView): readonly Edit[] {
  if (view.byteLength === 0) {
    return [];
  }
  return Arr.makeBy(view.byteLength / RECORD_BYTES, (index) => {
    const at = index * RECORD_BYTES;
    return {
      block: view.getUint8(at + 3),
      x: view.getUint8(at),
      y: view.getUint8(at + 1),
      z: view.getUint8(at + 2),
    };
  });
}

/** Packs edits whose every field the Edit schema has already checked. */
function writeRecords(edits: readonly Edit[]) {
  const buffer = new ArrayBuffer(edits.length * RECORD_BYTES);
  const view = new DataView(buffer);
  Arr.forEach(edits, (edit, index) => {
    const at = index * RECORD_BYTES;
    view.setUint8(at, edit.x);
    view.setUint8(at + 1, edit.y);
    view.setUint8(at + 2, edit.z);
    view.setUint8(at + 3, edit.block);
  });
  return buffer;
}

/**
 * A learner's edits, stored and sent as one packed `ArrayBuffer` and read as a
 * list in code, on the server and in the browser alike. A buffer whose length
 * is not a whole number of records, or a record outside the world, is refused.
 */
export const Edits = Schema.instanceOf(ArrayBuffer).pipe(
  Schema.decodeTo(
    Schema.Array(Edit),
    SchemaTransformation.transformEffect<readonly Edit[], ArrayBuffer>({
      decode: (buffer, options) =>
        buffer.byteLength % RECORD_BYTES === 0
          ? Effect.succeed(readRecords(new DataView(buffer)))
          : Effect.fail(
              new SchemaIssue.InvalidValue(
                { message: "An island's edits hold whole records only." },
                buffer.byteLength,
                options
              )
            ),
      encode: (edits) => Effect.succeed(writeRecords(edits)),
    })
  )
);

/** The world's order of edits, so the same cells always store the same bytes. */
const byCell = Order.mapInput(Order.Number, cellKeyOf);

/**
 * The stored edits with a batch laid over them: each cell keeps the last block
 * written to it, and every cell is stored once, in the world's order.
 */
export function mergeEdits(stored: readonly Edit[], batch: readonly Edit[]) {
  const cells = MutableHashMap.empty<number, Edit>();
  for (const edit of Arr.appendAll(stored, batch)) {
    MutableHashMap.set(cells, cellKeyOf(edit), edit);
  }
  return Arr.sort(MutableHashMap.values(cells), byCell);
}

/** The first and last cell, inclusive, of the footprint an island of this side covers. */
export function footprintOf(size: number) {
  const from = (SPAN - size) / 2;
  return { from, to: from + size - 1 };
}
