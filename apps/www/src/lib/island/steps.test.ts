// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { footingAt } from "@/lib/island/steps";
import { cover, flood, PLAIN, plainOf, raise } from "@/lib/island/test.plain";

describe("island/steps", () => {
  it("hears open ground and meadow as grass, a forest's floor as soil, a path as gravel and a beach as sand", () => {
    const land = plainOf(0);
    cover(land, 2, 2, "meadow");
    cover(land, 4, 2, "forest");
    cover(land, 6, 2, "path");
    cover(land, 8, 2, "sand");
    expect(footingAt(land, 14.2, 2.1)).toBe("grass");
    expect(footingAt(land, 2.2, 2.1)).toBe("grass");
    expect(footingAt(land, 4.3, 1.8)).toBe("soil");
    expect(footingAt(land, 5.8, 2.2)).toBe("gravel");
    expect(footingAt(land, 8.1, 2)).toBe("sand");
  });

  it("hears water wherever the fox wades or swims, whatever lies under it", () => {
    const land = plainOf(0);
    for (const i of [10, 11, 12]) {
      for (const j of [10, 11, 12]) {
        flood(land, i, j, 0.2);
        cover(land, i, j, "sand");
      }
    }
    expect(footingAt(land, 11, 11)).toBe("water");
    expect(footingAt(land, 20, 20)).toBe("grass");
  });

  it("hears bare rock where the ground is too steep to hold turf", () => {
    const land = plainOf(0);
    raise(land, 16, 16, PLAIN + 3);
    expect(footingAt(land, 15.6, 16)).toBe("stone");
  });
});
