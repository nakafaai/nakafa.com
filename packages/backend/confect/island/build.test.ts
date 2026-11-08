import { describe, expect, it } from "@effect/vitest";
import {
  applyOperations,
  type Operation,
} from "@repo/backend/confect/island/build";
import type { Placement } from "@repo/backend/confect/island/layout";
import type { Materials } from "@repo/backend/confect/island/material";
import { STARTER_LAYOUT } from "@repo/backend/confect/island/starter";
import { Result } from "effect";

/** An island at level 2, 8 cells wide, with no badge, 200 Stars and no materials to spend. */
const CONTEXT = {
  level: 2,
  materials: { petals: 0, wood: 0 },
  size: 8,
  stars: 200,
} as const;

/** A cell named by its first footprint cell. */
const at = (x: number, y: number, z = 0) => ({ x, y, z });

/** Places an item at a stage, facing north. */
const place = (
  item: Placement["item"],
  x: number,
  y: number,
  z = 0,
  stage = 0
): Operation => ({ _tag: "place", at: at(x, y, z), item, rotation: 0, stage });

/** Applies a batch to a layout with the test island's context, changed where given. */
function apply(
  operations: readonly Operation[],
  layout: readonly Placement[] = [],
  context: Partial<{
    level: number;
    materials: Materials;
    stars: number;
  }> = {}
) {
  return applyOperations(layout, operations, { ...CONTEXT, ...context });
}

/** The change a batch is refused at and why, or none when it applies. */
function refusal(...args: Parameters<typeof apply>) {
  return Result.match(apply(...args), {
    onFailure: (refused) => [refused.index, refused.reason] as const,
    onSuccess: () => undefined,
  });
}

/** What a batch leaves, failing the test when it is refused. */
function applied(...args: Parameters<typeof apply>) {
  return Result.getOrThrow(apply(...args));
}

describe("island/build", () => {
  it("buys an item at its stage and keeps what it paid", () => {
    const edited = applied([place("pond", 0, 0, 0, 1), place("grass", 3, 3)]);
    expect(edited.stars).toBe(200 - (40 + 60) - 2);
    expect(edited.layout).toEqual([
      {
        growth: 0,
        item: "pond",
        paid: 100,
        rotation: 0,
        stage: 1,
        x: 0,
        y: 0,
        z: 0,
      },
      {
        growth: 0,
        item: "grass",
        paid: 2,
        rotation: 0,
        stage: 0,
        x: 3,
        y: 3,
        z: 0,
      },
    ]);
  });

  it("refuses what leaves the island, overlaps, floats, is locked or costs too much", () => {
    expect(refusal([place("house", 7, 0)])).toEqual([0, "outside"]);
    expect(refusal([place("house", 0, 7)])).toEqual([0, "outside"]);
    expect(refusal([place("grass", 1, 1), place("tree", 1, 1)])).toEqual([
      1,
      "overlap",
    ]);
    expect(refusal([place("tree", 1, 1), place("grass", 1, 1, 1)])).toEqual([
      1,
      "overlap",
    ]);
    expect(refusal([place("tree", 1, 1, 1)])).toEqual([0, "unsupported"]);
    expect(refusal([place("grass", 1, 1), place("pond", 1, 1, 1)])).toEqual([
      1,
      "unsupported",
    ]);
    expect(refusal([place("tile", 0, 0)])).toEqual([0, "locked"]);
    expect(refusal([place("house", 0, 0, 0, 2)])).toEqual([0, "locked"]);
    expect(refusal([place("house", 0, 0, 0, 1)], [], { stars: 10 })).toEqual([
      0,
      "unaffordable",
    ]);
    expect(refusal([place("grass", 0, 0, 0, 1)])).toEqual([0, "top"]);
    expect(refusal([place("tree", 0, 0, 0, 1)])).toEqual([0, "top"]);
  });

  it("spends materials a stage costs, refuses without them, and returns them on removal", () => {
    expect(refusal([place("planks", 0, 0)])).toEqual([0, "materials"]);
    const wood = { materials: { petals: 0, wood: 2 } };
    const built = applied([place("planks", 0, 0)], [], wood);
    expect(built.materials).toEqual({ petals: 0, wood: 1 });
    expect(built.stars).toBe(198);
    const removed = applied([{ _tag: "remove", at: at(0, 0) }], built.layout, {
      materials: built.materials,
      stars: built.stars,
    });
    expect(removed.materials).toEqual({ petals: 0, wood: 2 });
  });

  it("grows a plant by watering only, and keeps a grown one in the ground", () => {
    const tree = { ...STARTER_LAYOUT[1], paid: 5, stage: 1, growth: 2 };
    expect(refusal([{ _tag: "upgrade", at: at(1, 1) }], [tree])).toEqual([
      0,
      "grows",
    ]);
    expect(refusal([{ _tag: "downgrade", at: at(1, 1) }], [tree])).toEqual([
      0,
      "grows",
    ]);
    expect(refusal([{ _tag: "remove", at: at(1, 1) }], [tree])).toEqual([
      0,
      "rooted",
    ]);
    const moved = applied(
      [{ _tag: "move", from: at(1, 1), rotation: 0, to: at(4, 4) }],
      [tree]
    );
    expect(moved.layout[0]).toMatchObject({ growth: 2, stage: 1, x: 4 });
    const seed = applied([place("tree", 0, 0)]);
    expect(
      applied([{ _tag: "remove", at: at(0, 0) }], seed.layout, {
        stars: seed.stars,
      }).stars
    ).toBe(200);
  });

  it("stacks blocks and stands a piece only on blocks under its whole footprint", () => {
    expect(
      applied(
        [place("grass", 0, 0), place("stone", 0, 0, 1), place("tree", 0, 0, 2)],
        [],
        {
          level: 3,
        }
      ).layout
    ).toHaveLength(3);
    expect(refusal([place("grass", 4, 4), place("house", 4, 4, 1)])).toEqual([
      1,
      "unsupported",
    ]);
  });

  it("refunds what a placement paid and keeps the starter set", () => {
    const bought = applied([place("pond", 0, 0, 0, 1)]);
    const removed = applied([{ _tag: "remove", at: at(0, 0) }], bought.layout, {
      stars: bought.stars,
    });
    expect(removed.stars).toBe(200);
    expect(removed.layout).toEqual([]);
    expect(refusal([{ _tag: "remove", at: at(3, 2) }], STARTER_LAYOUT)).toEqual(
      [0, "starter"]
    );
    expect(refusal([{ _tag: "remove", at: at(5, 5) }])).toEqual([0, "missing"]);
  });

  it("keeps a block that something stands on", () => {
    const stacked = applied([
      place("grass", 0, 0),
      place("bush", 0, 0, 1),
    ]).layout;
    expect(refusal([{ _tag: "remove", at: at(0, 0) }], stacked)).toEqual([
      0,
      "carrying",
    ]);
    expect(
      refusal(
        [{ _tag: "move", from: at(0, 0), rotation: 0, to: at(3, 3) }],
        stacked
      )
    ).toEqual([0, "carrying"]);
  });

  it("moves and turns a piece where it fits, and nowhere it does not", () => {
    const moved = applied(
      [{ _tag: "move", from: at(3, 2), rotation: 1, to: at(5, 5) }],
      STARTER_LAYOUT
    );
    expect(moved.layout[0]).toMatchObject({ rotation: 1, x: 5, y: 5 });
    expect(moved.stars).toBe(200);
    expect(
      refusal(
        [{ _tag: "move", from: at(3, 2), rotation: 0, to: at(1, 1) }],
        STARTER_LAYOUT
      )
    ).toEqual([0, "overlap"]);
  });

  it("upgrades for the next stage's price and materials and downgrades for its refund, never below what was paid", () => {
    const wood = { petals: 0, wood: 6 };
    const upgraded = applied(
      [{ _tag: "upgrade", at: at(3, 2) }],
      STARTER_LAYOUT,
      { materials: wood }
    );
    expect(upgraded.layout[0]).toMatchObject({ paid: 150, stage: 1 });
    expect(upgraded.stars).toBe(50);
    expect(upgraded.materials).toEqual({ petals: 0, wood: 0 });
    const back = applied(
      [{ _tag: "downgrade", at: at(3, 2) }],
      upgraded.layout,
      { materials: upgraded.materials, stars: upgraded.stars }
    );
    expect(back.layout[0]).toMatchObject({ paid: 0, stage: 0 });
    expect(back.stars).toBe(200);
    expect(back.materials).toEqual(wood);
    const cameGrown = [{ ...STARTER_LAYOUT[0], stage: 1 }];
    expect(refusal([{ _tag: "downgrade", at: at(3, 2) }], cameGrown)).toEqual([
      0,
      "starter",
    ]);
    expect(
      refusal([{ _tag: "downgrade", at: at(3, 2) }], STARTER_LAYOUT)
    ).toEqual([0, "bottom"]);
    expect(
      refusal([{ _tag: "upgrade", at: at(3, 2) }], STARTER_LAYOUT, {
        level: 1,
      })
    ).toEqual([0, "locked"]);
    expect(
      refusal([{ _tag: "upgrade", at: at(3, 2) }], STARTER_LAYOUT, {
        stars: 10,
      })
    ).toEqual([0, "unaffordable"]);
    expect(
      refusal([{ _tag: "upgrade", at: at(3, 2) }], STARTER_LAYOUT)
    ).toEqual([0, "materials"]);
    expect(
      refusal(
        [{ _tag: "upgrade", at: at(0, 0) }],
        applied([place("grass", 0, 0)]).layout
      )
    ).toEqual([0, "top"]);
  });

  it("returns the batch that puts the island back exactly as it was", () => {
    const batch: readonly Operation[] = [
      place("grass", 0, 0),
      place("bush", 0, 0, 1),
      { _tag: "move", from: at(3, 2), rotation: 2, to: at(4, 4) },
      { _tag: "upgrade", at: at(4, 4) },
      { _tag: "remove", at: at(0, 0, 1) },
    ];
    const edited = applied(batch, STARTER_LAYOUT, {
      materials: { petals: 1, wood: 7 },
    });
    const restored = applied(edited.undo, edited.layout, {
      materials: edited.materials,
      stars: edited.stars,
    });
    expect(restored.stars).toBe(200);
    expect(restored.materials).toEqual({ petals: 1, wood: 7 });
    expect(restored.layout).toEqual(
      expect.arrayContaining([...STARTER_LAYOUT])
    );
    expect(restored.layout).toHaveLength(STARTER_LAYOUT.length);
  });
});
