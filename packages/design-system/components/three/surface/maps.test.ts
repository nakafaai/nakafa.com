import { describe, expect, it } from "@effect/vitest";
import { surfaceMaps } from "@repo/design-system/components/three/surface/maps";
import { RepeatWrapping, SRGBColorSpace } from "three";

describe("surfaceMaps", () => {
  it("paints a surface once and shares its repeating textures", () => {
    const first = surfaceMaps("paint");

    expect(surfaceMaps("paint")).toBe(first);
    expect(first.tone.wrapS).toBe(RepeatWrapping);
    expect(first.tone.colorSpace).toBe(SRGBColorSpace);
    expect(first.roughness.colorSpace).not.toBe(SRGBColorSpace);
  });
});
