// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { BLOCK_KEYS, idOf } from "@repo/backend/confect/island/blocks";
import { SLOTS } from "@/lib/island/atlas";
import { KIND, LOOK, looksOf } from "@/lib/island/look";

describe("island/look", () => {
  it("draws grass with its own top and sides over dirt", () => {
    expect(looksOf("grass")).toEqual({
      bottom: "dirt",
      kind: "solid",
      side: "grassSide",
      top: "grassTop",
    });
    const grass = idOf("grass");
    expect(LOOK.tops[grass]).toBe(SLOTS.grassTop);
    expect(LOOK.sides[grass]).toBe(SLOTS.grassSide);
    expect(LOOK.bottoms[grass]).toBe(SLOTS.dirt);
  });

  it("tells the mesher how each block is drawn and which one glows", () => {
    expect(LOOK.kinds[0]).toBe(KIND.air);
    expect(LOOK.kinds[idOf("glass")]).toBe(KIND.cutout);
    expect(LOOK.kinds[idOf("water")]).toBe(KIND.liquid);
    expect(LOOK.kinds[idOf("flowers")]).toBe(KIND.cross);
    expect(LOOK.glows[idOf("lantern")]).toBe(15);
    expect(LOOK.glows[idOf("stone")]).toBe(0);
    for (const key of BLOCK_KEYS) {
      expect(LOOK.kinds[idOf(key)], key).not.toBe(KIND.air);
    }
  });
});
