// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { Option } from "effect";
import { planOf } from "@/lib/island/plan";
import { cellOf, emptyCells } from "@/lib/island/world";

const planks = idOf("planks");

/** A world with grass at (30, 8, 30) and water at (31, 7, 30). */
function world() {
  const cells = emptyCells();
  cells[cellOf(30, 8, 30)] = idOf("grass");
  cells[cellOf(31, 7, 30)] = idOf("water");
  return cells;
}

describe("island/plan", () => {
  it("places the held block in front of the face it hit", () => {
    const hit = {
      block: idOf("grass"),
      hit: [30, 8, 30] as const,
      place: [30, 9, 30] as const,
    };
    expect(planOf(world(), hit, planks, 16)).toEqual(
      Option.some({ after: planks, before: 0, x: 30, y: 9, z: 30 })
    );
  });

  it("fills the water it hit, and digs out what the pickaxe hits", () => {
    const water = {
      block: idOf("water"),
      hit: [31, 7, 30] as const,
      place: [31, 8, 30] as const,
    };
    expect(planOf(world(), water, planks, 16)).toEqual(
      Option.some({ after: planks, before: idOf("water"), x: 31, y: 7, z: 30 })
    );
    const grass = {
      block: idOf("grass"),
      hit: [30, 8, 30] as const,
      place: [30, 9, 30] as const,
    };
    expect(planOf(world(), grass, 0, 16)).toEqual(
      Option.some({ after: 0, before: idOf("grass"), x: 30, y: 8, z: 30 })
    );
  });

  it("makes no edit outside the footprint, on the bedrock, past the world, or of a block onto itself", () => {
    const cells = world();
    const at = (
      hit: readonly [number, number, number],
      place: readonly [number, number, number]
    ) => ({ block: idOf("grass"), hit, place });
    expect(planOf(cells, at([28, 8, 30], [28, 9, 30]), planks, 4)).toEqual(
      Option.none()
    );
    expect(planOf(cells, at([30, 0, 30], [30, 1, 30]), 0, 16)).toEqual(
      Option.none()
    );
    expect(planOf(cells, at([0, 8, 30], [-1, 8, 30]), planks, 64)).toEqual(
      Option.none()
    );
    expect(
      planOf(cells, at([30, 9, 30], [30, 8, 30]), idOf("grass"), 16)
    ).toEqual(Option.none());
    expect(planOf(cells, at([30, 8, 40], [30, 9, 40]), planks, 16)).toEqual(
      Option.none()
    );
  });
});
