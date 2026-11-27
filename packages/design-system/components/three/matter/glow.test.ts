import { describe, expect, it } from "@effect/vitest";
import {
  hotness,
  matterGlow,
  tintOf,
} from "@repo/design-system/components/three/matter/glow";
import { matterLook } from "@repo/design-system/components/three/matter/recipe";
import { MATTER_COLORS } from "@repo/design-system/lib/material/matter";

describe("matterGlow", () => {
  it("casts light in the colour the material itself glows in", () => {
    const asks = [
      { glow: 1, of: "tungsten" },
      { glow: 0.7, of: "nichrome" },
      { color: "#30d158", glow: 1.6, of: "epoxy" },
      { color: "#ffd68a", of: "light" },
    ] as const;

    for (const ask of asks) {
      const glow = matterGlow(ask);
      const look = matterLook(ask);

      expect(glow.color).toBe(look.emissive);
      expect(glow.strength).toBe(look.emissiveIntensity);
      expect(glow.cast).toBeGreaterThan(0);
    }
  });

  it("throws no light from what does not glow", () => {
    expect(matterGlow({ of: "tungsten" }).cast).toBe(0);
    expect(matterGlow({ of: "glass" }).cast).toBe(0);
    expect(matterGlow({ color: "#30d158", of: "epoxy" }).cast).toBe(0);
    expect(matterGlow({ color: "#30d158", glow: -2, of: "epoxy" }).cast).toBe(
      0
    );
  });

  it("lets the light of a hot metal fall far faster than its heat", () => {
    const white = matterGlow({ glow: 1, of: "tungsten" });
    const half = matterGlow({ glow: 0.5, of: "tungsten" });
    const heater = matterGlow({ glow: 1, of: "nichrome" });

    expect(half.strength).toBeGreaterThan(white.strength / 4);
    expect(half.cast).toBeLessThan(white.cast / 30);
    expect(heater.cast).toBeLessThan(white.cast / 10);
    expect(heater.cast).toBeGreaterThan(0);
  });

  it("lights a lens or a beam in step with its glow", () => {
    const lens = matterGlow({ color: "#30d158", glow: 1, of: "epoxy" });
    const bright = matterGlow({ color: "#30d158", glow: 2, of: "epoxy" });

    expect(bright.cast).toBeCloseTo(lens.cast * 2);
    expect(matterGlow({ color: "#ffd68a", of: "light" }).cast).toBeCloseTo(
      lens.cast
    );
  });
});

describe("hotness", () => {
  it("holds a metal's glow between cold and the hottest it is run", () => {
    expect(hotness(undefined)).toBe(0);
    expect(hotness(-1)).toBe(0);
    expect(hotness(0.4)).toBe(0.4);
    expect(hotness(3)).toBe(1);
  });
});

describe("tintOf", () => {
  it("answers the colour a part was given, or the material's own", () => {
    expect(tintOf({ color: "#c62828", of: "enamel" })).toBe("#c62828");
    expect(tintOf({ of: "oak" })).toBe(MATTER_COLORS.oak);
    expect(tintOf({ color: "#3a2416", of: "oak" })).toBe("#3a2416");
  });
});
