// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { Option } from "effect";
import type { Animal } from "@/lib/island/life";
import { headingOf, roomOf, touches } from "@/lib/island/room";
import { cellOf, emptyCells } from "@/lib/island/world";

/** A meadow of grass at y = 8 over a 20 by 20 square, a stone wall two blocks high along x = 10. */
function meadow() {
  const cells = emptyCells();
  for (let z = 0; z < 20; z += 1) {
    for (let x = 0; x < 20; x += 1) {
      cells[cellOf(x, 8, z)] = idOf("grass");
    }
    cells[cellOf(10, 9, z)] = idOf("stone");
    cells[cellOf(10, 10, z)] = idOf("stone");
  }
  cells[cellOf(4, 9, 4)] = idOf("tulip");
  return cells;
}

const at = (
  kind: Animal["kind"],
  x: number,
  z: number,
  tx = x,
  tz = z
): Animal => ({
  kind,
  rest: 0,
  steps: 0,
  tx,
  tz,
  x,
  z,
});

describe("island/room", () => {
  it("fits a body on open ground and over a low flower, never through a rose bush, across a wall, up a step or over nothing", () => {
    const cells = meadow();
    expect(roomOf(cells, "cat", 5.5, 5.5, 0)).toBe(true);
    expect(roomOf(cells, "hen", 4.5, 4.5, 0)).toBe(true);
    // A rose bush stands taller than a knee: a hen goes round it.
    cells[cellOf(6, 9, 6)] = idOf("rose");
    expect(roomOf(cells, "hen", 6.5, 6.5, 0)).toBe(false);
    // Atop the wall is a floor of its own, which a walker on the meadow never climbs to.
    expect(roomOf(cells, "cat", 10.5, 5.5, 0, Option.some(9))).toBe(false);
    expect(roomOf(cells, "cat", 9.8, 5.5, 0)).toBe(false);
    // A cow is long: facing the wall it does not fit, though its middle stands clear of it.
    expect(roomOf(cells, "cow", 8.9, 5.5, Math.PI / 2)).toBe(false);
    expect(roomOf(cells, "cow", 8.9, 5.5, 0)).toBe(true);
    expect(roomOf(cells, "cat", 30.5, 30.5, 0)).toBe(false);
    cells[cellOf(5, 9, 6)] = idOf("dirt");
    expect(roomOf(cells, "cat", 5.5, 6.5, 0, Option.some(9))).toBe(false);
    // A stone at head height over the meadow is a roof a walker there cannot pass under.
    cells[cellOf(5, 9, 5)] = 0;
    cells[cellOf(5, 10, 5)] = idOf("stone");
    expect(roomOf(cells, "cat", 5.5, 5.5, 0, Option.some(9))).toBe(false);
  });

  it("says when two bodies overlap, a cow by the length it faces", () => {
    expect(touches(at("cat", 5, 5), at("bear", 5.4, 5))).toBe(true);
    expect(touches(at("cat", 5, 5), at("bear", 6.5, 5))).toBe(false);
    const cow = at("cow", 5, 5, 5, 9);
    expect(headingOf(cow)).toBeCloseTo(0);
    expect(touches(cow, at("hen", 5, 6.3))).toBe(true);
    expect(touches(cow, at("hen", 6.3, 5))).toBe(false);
    expect(headingOf(at("hen", 5, 5))).toBe(0);
  });
});
