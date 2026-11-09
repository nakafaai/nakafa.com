// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { Option, Result } from "effect";
import type { Edit } from "@/lib/island/edits";
import {
  HOME,
  nextTierOf,
  tierOf,
  tierOpensAt,
  upgradeOf,
} from "@/lib/island/home";
import { terrainOf } from "@/lib/island/terrain";
import { cellOf } from "@/lib/island/world";

/** Writes edits into the world, as the store does. */
function apply(cells: Uint8Array, edits: readonly Edit[]) {
  for (const edit of edits) {
    cells[cellOf(edit.x, edit.y, edit.z)] = edit.after;
  }
}

describe("island/home", () => {
  it("raises the village cottage to a two-storey house and then a manor, each at its level, and no further", () => {
    const cells = terrainOf(11, 52);
    expect(tierOf(cells)).toBe(0);
    expect(tierOpensAt(1)).toBe(3);
    expect(tierOpensAt(2)).toBe(4);
    expect(upgradeOf(cells, 2)).toEqual(Result.fail("locked"));
    const second = upgradeOf(cells, 3);
    expect(Result.isSuccess(second)).toBe(true);
    if (Result.isSuccess(second)) {
      apply(cells, second.success.edits);
    }
    expect(tierOf(cells)).toBe(1);
    expect(nextTierOf(cells)).toEqual(Option.some(2));
    expect(upgradeOf(cells, 3)).toEqual(Result.fail("locked"));
    const manor = upgradeOf(cells, 4);
    if (Result.isSuccess(manor)) {
      apply(cells, manor.success.edits);
    }
    expect(tierOf(cells)).toBe(2);
    expect(cells[cellOf(HOME.x - 1, HOME.y, HOME.z - 3)]).toBe(idOf("brick"));
    expect(upgradeOf(cells, 7)).toEqual(Result.fail("top"));
    expect(nextTierOf(cells)).toEqual(Option.none());
  });

  it("refuses to build through something the learner put where the new walls go", () => {
    const cells = terrainOf(11, 52);
    cells[cellOf(HOME.x - 3, HOME.y + 5, HOME.z - 2)] = idOf("stone");
    expect(upgradeOf(cells, 7)).toEqual(Result.fail("room"));
  });
});
