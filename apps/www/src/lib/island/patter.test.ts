// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { roofShareOf } from "@/lib/island/patter";
import { cellOf, emptyCells } from "@/lib/island/world";

describe("island/patter", () => {
  it("counts the share of land under a roof, and none on an empty island", () => {
    const cells = emptyCells();
    expect(roofShareOf(cells)).toBe(0);
    cells[cellOf(4, 8, 4)] = idOf("grass");
    cells[cellOf(5, 8, 4)] = idOf("grass");
    cells[cellOf(6, 8, 4)] = idOf("grass");
    cells[cellOf(6, 12, 4)] = idOf("roof");
    cells[cellOf(7, 12, 4)] = idOf("slate");
    expect(roofShareOf(cells)).toBe(2 / 4);
  });
});
