// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { applyEdits, chunksAround, inverseOf } from "@/lib/island/edits";
import { blockAt, CHUNKS, emptyCells } from "@/lib/island/world";

describe("island/edits", () => {
  it("undoes edits in reverse, each putting back what it replaced", () => {
    const edits = [
      { after: 5, before: 0, x: 1, y: 9, z: 1 },
      { after: 7, before: 5, x: 1, y: 9, z: 1 },
    ];
    expect(inverseOf(edits)).toEqual([
      { after: 5, before: 7, x: 1, y: 9, z: 1 },
      { after: 0, before: 5, x: 1, y: 9, z: 1 },
    ]);
  });

  it("redraws a cell's own chunk and every neighbour across an edge it touches", () => {
    expect(chunksAround(20, 20)).toEqual([CHUNKS + 1]);
    expect(chunksAround(16, 20)).toEqual([CHUNKS, CHUNKS + 1]);
    expect(chunksAround(31, 31)).toEqual([
      CHUNKS + 1,
      2 * CHUNKS + 1,
      CHUNKS + 2,
      2 * CHUNKS + 2,
    ]);
    expect(chunksAround(0, 0)).toEqual([0]);
    expect(chunksAround(63, 63)).toEqual([CHUNKS * CHUNKS - 1]);
  });

  it("writes the new blocks and answers the chunks to redraw", () => {
    const cells = emptyCells();
    const touched = applyEdits(cells, [
      { after: 3, before: 0, x: 2, y: 9, z: 40 },
    ]);
    expect(blockAt(cells, 2, 9, 40)).toBe(3);
    expect(Arr.fromIterable(touched)).toEqual([2 * CHUNKS]);
  });
});
