import { describe, expect, it } from "@effect/vitest";
import {
  breathAt,
  lightNucleon,
  NUCLEON_PROGRAM,
  swellOf,
} from "@repo/design-system/components/three/atom/matter";
import { Array as Arr } from "effect";

describe("lightNucleon", () => {
  it("turns what the material emits into a glow and a rim light in its own colour", () => {
    const program = {
      fragmentShader: "before\n#include <emissivemap_fragment>\nafter",
    };
    lightNucleon(program);
    const lines = program.fragmentShader.split("\n");
    expect(lines[0]).toBe("before");
    expect(lines[1]).toBe("#include <emissivemap_fragment>");
    expect(lines[2]).toContain("dot(normal, normalize(vViewPosition))");
    expect(lines[3]).toContain("totalEmissiveRadiance = diffuseColor.rgb *");
    expect(lines[3]).toContain("mix(diffuseColor.rgb, vec3(1.0), 0.35)");
    expect(lines[4]).toBe("diffuseColor.rgb *= 0.62;");
    expect(lines[5]).toBe("after");
    expect(NUCLEON_PROGRAM).toBe("atom-nucleon");
  });
});

describe("swellOf", () => {
  it("draws nucleons near their packed size, most a little larger, no two quite alike", () => {
    const swells = Arr.map(Arr.range(0, 39), swellOf);
    expect(Math.min(...swells)).toBeGreaterThanOrEqual(0.98);
    expect(Math.max(...swells)).toBeLessThanOrEqual(1.08);
    expect(swellOf(1)).not.toBeCloseTo(swellOf(2), 3);
  });
});

describe("breathAt", () => {
  it("swells and brightens the glow gently and returns", () => {
    expect(breathAt(0)).toEqual({ glow: 1, size: 1 });
    const peak = breathAt(Math.PI / 2.6);
    expect(peak.size).toBeCloseTo(1.05, 5);
    expect(peak.glow).toBeCloseTo(1.16, 5);
    expect(breathAt((3 * Math.PI) / 2.6).size).toBeCloseTo(0.95, 5);
  });
});
