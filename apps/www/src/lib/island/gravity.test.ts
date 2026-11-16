// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { settleOf } from "@/lib/island/gravity";
import { blockAt, cellOf, emptyCells } from "@/lib/island/world";

/** A world of stone up to y = 8. */
function ground() {
  const cells = emptyCells();
  for (let y = 0; y <= 8; y += 1) {
    cells[cellOf(5, y, 5)] = idOf("stone");
    cells[cellOf(6, y, 5)] = idOf("stone");
  }
  return cells;
}

describe("island/gravity", () => {
  it("drops sand left over a hollow down to rest, a stack together, and keeps built blocks where they are", () => {
    const cells = ground();
    cells[cellOf(5, 12, 5)] = idOf("sand");
    cells[cellOf(5, 13, 5)] = idOf("sand");
    cells[cellOf(6, 12, 5)] = idOf("planks");
    const settled = settleOf(cells, [
      { after: 0, before: idOf("stone"), x: 5, y: 9, z: 5 },
      { after: 0, before: idOf("stone"), x: 6, y: 9, z: 5 },
    ]);
    expect(blockAt(cells, 5, 9, 5)).toBe(idOf("sand"));
    expect(blockAt(cells, 5, 10, 5)).toBe(idOf("sand"));
    expect(blockAt(cells, 5, 12, 5)).toBe(0);
    expect(blockAt(cells, 5, 13, 5)).toBe(0);
    expect(blockAt(cells, 6, 12, 5)).toBe(idOf("planks"));
    expect(settled).toEqual([
      { after: 0, before: idOf("sand"), x: 5, y: 12, z: 5 },
      { after: idOf("sand"), before: 0, x: 5, y: 9, z: 5 },
      { after: 0, before: idOf("sand"), x: 5, y: 13, z: 5 },
      { after: idOf("sand"), before: 0, x: 5, y: 10, z: 5 },
    ]);
  });

  it("loses a plant whose ground is gone, and sinks sand through water to the floor", () => {
    const cells = ground();
    cells[cellOf(5, 9, 5)] = idOf("rose");
    cells[cellOf(5, 8, 5)] = 0;
    settleOf(cells, [{ after: 0, before: idOf("stone"), x: 5, y: 8, z: 5 }]);
    expect(blockAt(cells, 5, 9, 5)).toBe(0);
    cells[cellOf(6, 8, 5)] = idOf("water");
    cells[cellOf(6, 7, 5)] = idOf("water");
    cells[cellOf(6, 9, 5)] = idOf("sand");
    settleOf(cells, [{ after: idOf("sand"), before: 0, x: 6, y: 9, z: 5 }]);
    expect(blockAt(cells, 6, 7, 5)).toBe(idOf("sand"));
    expect(blockAt(cells, 6, 9, 5)).toBe(0);
    expect(settleOf(cells, [])).toEqual([]);
  });

  it("drops sand through a flower, which it buries, and down to the world's floor where nothing holds it", () => {
    const cells = ground();
    cells[cellOf(5, 9, 5)] = idOf("rose");
    cells[cellOf(5, 10, 5)] = idOf("sand");
    settleOf(cells, [{ after: idOf("sand"), before: 0, x: 5, y: 10, z: 5 }]);
    expect(blockAt(cells, 5, 9, 5)).toBe(idOf("sand"));
    expect(blockAt(cells, 5, 10, 5)).toBe(0);
    const open = emptyCells();
    open[cellOf(9, 3, 9)] = idOf("sand");
    settleOf(open, [{ after: idOf("sand"), before: 0, x: 9, y: 3, z: 9 }]);
    expect(blockAt(open, 9, 0, 9)).toBe(idOf("sand"));
  });
});
