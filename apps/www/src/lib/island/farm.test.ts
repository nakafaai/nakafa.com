import { describe, expect, it } from "@effect/vitest";
import island from "@repo/backend/confect/_generated/refs/island";
import { STARTER_LAYOUT } from "@repo/backend/confect/island/starter";
import { Option } from "effect";
import {
  harvestIslandChange,
  ripeYield,
  waterIslandChange,
  waterRefusal,
} from "@/lib/island/farm";
import { createLocalStore } from "@/test/optimistic";

/** The owner's island as its query answers it, before they ever learned. */
const UNLEARNED = {
  badges: [],
  layout: STARTER_LAYOUT,
  level: 1,
  lifetime: 20,
  materials: { petals: 0, wood: 0 },
  stars: 20,
  timeZone: "Asia/Jakarta",
  version: 3,
  visibility: "private" as const,
};

/** The same island on a day its owner learned. */
const OWN = { ...UNLEARNED, learned: "2026-11-08" };

/** The starter tree, grown to its fruit. */
const RIPE = [
  STARTER_LAYOUT[0],
  { ...STARTER_LAYOUT[1], growth: 0, stage: 3 },
] as const;

describe("island farm", () => {
  it("waters only on a day of learning, once, and only a garden with a plant", () => {
    const garden = {
      layout: STARTER_LAYOUT,
      learned: Option.some("2026-11-08"),
      watered: Option.none(),
    };
    expect(waterRefusal(garden, "2026-11-08")).toEqual(Option.none());
    expect(waterRefusal(garden, "2026-11-09")).toEqual(
      Option.some("unlearned")
    );
    expect(
      waterRefusal(
        { ...garden, watered: Option.some("2026-11-08") },
        "2026-11-08"
      )
    ).toEqual(Option.some("watered"));
    expect(
      waterRefusal({ ...garden, layout: [STARTER_LAYOUT[0]] }, "2026-11-08")
    ).toEqual(Option.some("barren"));
  });

  it("names what a ripe plant gives, and nothing for a plant still growing or a block", () => {
    expect(ripeYield(RIPE[1])).toEqual(Option.some("wood"));
    expect(
      ripeYield({ ...STARTER_LAYOUT[1], growth: 2, item: "flowers", stage: 1 })
    ).toEqual(Option.some("petals"));
    expect(ripeYield(STARTER_LAYOUT[1])).toEqual(Option.none());
    expect(ripeYield(STARTER_LAYOUT[0])).toEqual(Option.none());
  });

  it("shows a watering at once on the day the owner learned", () => {
    const local = createLocalStore();
    local.seed(island.queries.own, {}, OWN);
    waterIslandChange(local.store, { version: 3 });
    const shown = Option.getOrThrow(
      local.store.getQuery(island.queries.own, {})
    );
    expect(shown).toMatchObject({ version: 4, watered: "2026-11-08" });
    expect(shown?.layout[1]).toMatchObject({ growth: 1, stage: 2 });
  });

  it("shows a harvest at once: the plant grown back and its wood added", () => {
    const local = createLocalStore();
    local.seed(island.queries.own, {}, { ...OWN, layout: RIPE });
    harvestIslandChange(local.store, { at: { x: 1, y: 1, z: 0 }, version: 3 });
    const shown = Option.getOrThrow(
      local.store.getQuery(island.queries.own, {})
    );
    expect(shown).toMatchObject({
      materials: { petals: 0, wood: 4 },
      version: 4,
    });
    expect(shown?.layout[1]).toMatchObject({ growth: 0, stage: 2 });
  });

  it("changes nothing when the rules refuse, before the island loads, or without an island", () => {
    const unlearned = createLocalStore();
    unlearned.seed(island.queries.own, {}, UNLEARNED);
    waterIslandChange(unlearned.store, { version: 3 });
    expect(unlearned.written()).toEqual([]);
    const barren = createLocalStore();
    barren.seed(
      island.queries.own,
      {},
      { ...OWN, layout: [STARTER_LAYOUT[0]] }
    );
    waterIslandChange(barren.store, { version: 3 });
    expect(barren.written()).toEqual([]);
    const unripe = createLocalStore();
    unripe.seed(island.queries.own, {}, OWN);
    harvestIslandChange(unripe.store, { at: { x: 1, y: 1, z: 0 }, version: 3 });
    expect(unripe.written()).toEqual([]);
    const empty = createLocalStore();
    waterIslandChange(empty.store, { version: 0 });
    harvestIslandChange(empty.store, { at: { x: 1, y: 1, z: 0 }, version: 0 });
    expect(empty.written()).toEqual([]);
    const none = createLocalStore();
    none.seed(island.queries.own, {}, null);
    waterIslandChange(none.store, { version: 0 });
    expect(none.written()).toEqual([]);
  });
});
