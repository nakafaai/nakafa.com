import { describe, expect, it } from "@effect/vitest";
import {
  cellKeyOf,
  Edits,
  footprintOf,
  mergeEdits,
  SPAN,
} from "@repo/backend/confect/island/world";
import { Effect, Schema } from "effect";

describe("island/world", () => {
  it("packs each edit into four bytes and reads it back", () => {
    const edits = [
      { block: 5, x: 1, y: 9, z: 2 },
      { block: 0, x: 63, y: 31, z: 63 },
    ];
    const packed = Schema.encodeSync(Edits)(edits);
    expect(packed.byteLength).toBe(8);
    expect(Schema.decodeSync(Edits)(packed)).toEqual(edits);
    expect(Schema.decodeSync(Edits)(new ArrayBuffer(0))).toEqual([]);
  });

  it.effect(
    "refuses bytes that are not whole records, and a record outside the world",
    () =>
      Effect.gen(function* () {
        const broken = yield* Schema.decodeEffect(Edits)(
          new ArrayBuffer(5)
        ).pipe(Effect.flip);
        expect(String(broken)).toContain("whole records");
        const outside = new Uint8Array([64, 1, 1, 1]).buffer;
        expect(Schema.decodeOption(Edits)(outside)._tag).toBe("None");
      })
  );

  it("keeps the last block written to each cell, once, in the world's order", () => {
    const merged = mergeEdits(
      [
        { block: 5, x: 3, y: 9, z: 1 },
        { block: 6, x: 1, y: 9, z: 1 },
      ],
      [
        { block: 0, x: 3, y: 9, z: 1 },
        { block: 7, x: 2, y: 8, z: 1 },
      ]
    );
    expect(merged).toEqual([
      { block: 7, x: 2, y: 8, z: 1 },
      { block: 6, x: 1, y: 9, z: 1 },
      { block: 0, x: 3, y: 9, z: 1 },
    ]);
    expect(cellKeyOf({ x: 1, y: 1, z: 1 })).toBe(SPAN * SPAN + SPAN + 1);
  });

  it("centers each footprint in the world", () => {
    expect(footprintOf(16)).toEqual({ from: 24, to: 39 });
    expect(footprintOf(SPAN)).toEqual({ from: 0, to: SPAN - 1 });
  });
});
