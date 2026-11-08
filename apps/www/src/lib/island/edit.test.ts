import { describe, expect, it } from "@effect/vitest";
import island from "@repo/backend/confect/_generated/refs/island";
import { STARTER_LAYOUT } from "@repo/backend/confect/island/starter";
import { Option } from "effect";
import { buildContextOf, editIslandChange } from "@/lib/island/edit";
import { createLocalStore } from "@/test/optimistic";

/** The owner's island as its query answers it, with 20 Stars to spend. */
const OWN = {
  badges: [],
  layout: STARTER_LAYOUT,
  level: 1,
  lifetime: 20,
  stars: 20,
  timeZone: "Asia/Jakarta",
  version: 3,
  visibility: "private" as const,
};

const grass = {
  _tag: "place" as const,
  at: { x: 0, y: 5, z: 0 },
  item: "grass" as const,
  rotation: 0,
  stage: 0,
};

describe("island edit", () => {
  it("reads the rules' view of the owner's island", () => {
    expect(buildContextOf(OWN)).toEqual({ level: 1, size: 6, stars: 20 });
  });

  it("shows an edit at once: the new layout, the Stars left and the next version", () => {
    const local = createLocalStore();
    local.seed(island.queries.own, {}, OWN);
    editIslandChange(local.store, { operations: [grass], version: 3 });
    const shown = Option.getOrThrow(
      local.store.getQuery(island.queries.own, {})
    );
    expect(shown).toMatchObject({ stars: 18, version: 4 });
    expect(shown?.layout).toHaveLength(3);
  });

  it("changes nothing for a batch the rules refuse, an island not loaded, or no island yet", () => {
    const refused = createLocalStore();
    refused.seed(island.queries.own, {}, OWN);
    editIslandChange(refused.store, {
      operations: [{ _tag: "remove", at: { x: 3, y: 2, z: 0 } }],
      version: 3,
    });
    expect(refused.written()).toEqual([]);
    const empty = createLocalStore();
    editIslandChange(empty.store, { operations: [grass], version: 0 });
    expect(empty.written()).toEqual([]);
    const none = createLocalStore();
    none.seed(island.queries.own, {}, null);
    editIslandChange(none.store, { operations: [grass], version: 0 });
    expect(none.written()).toEqual([]);
  });
});
