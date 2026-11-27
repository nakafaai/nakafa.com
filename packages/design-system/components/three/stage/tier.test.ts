import { describe, expect, it } from "@effect/vitest";
import {
  resolveStageProfile,
  resolveStageTier,
} from "@repo/design-system/components/three/stage/tier";

describe("resolveStageTier", () => {
  it("selects plain for software renderers, WebGL1, or missing half-float buffers", () => {
    expect(
      resolveStageTier({
        isWebGL2: true,
        lowEnd: false,
        mobile: false,
        renderer: "Google SwiftShader",
        supportsHalfFloat: true,
      })
    ).toBe("plain");

    expect(
      resolveStageTier({
        isWebGL2: false,
        lowEnd: false,
        mobile: false,
        renderer: "Apple M3",
        supportsHalfFloat: true,
      })
    ).toBe("plain");

    expect(
      resolveStageTier({
        isWebGL2: true,
        lowEnd: false,
        mobile: true,
        renderer: "Apple GPU",
        supportsHalfFloat: false,
      })
    ).toBe("plain");
  });

  it("selects low for hardware-constrained devices", () => {
    expect(
      resolveStageTier({
        isWebGL2: true,
        lowEnd: true,
        mobile: true,
        renderer: "Adreno (TM) 610",
        supportsHalfFloat: true,
      })
    ).toBe("low");
  });

  it("selects light for capable mobile GPUs", () => {
    expect(
      resolveStageTier({
        isWebGL2: true,
        lowEnd: false,
        mobile: true,
        renderer: "Apple GPU",
        supportsHalfFloat: true,
      })
    ).toBe("light");
  });

  it("selects full for capable desktop GPUs", () => {
    expect(
      resolveStageTier({
        isWebGL2: true,
        lowEnd: false,
        mobile: false,
        renderer: "ANGLE (Apple, Apple M3 Pro)",
        supportsHalfFloat: true,
      })
    ).toBe("full");
  });
});

describe("resolveStageProfile", () => {
  it("enables postprocessing, 2048 shadows, and desktop HDRI on full tier", () => {
    expect(resolveStageProfile("full", true)).toEqual({
      environmentDirectory: "desktop",
      landRings: 48,
      landSpokes: 96,
      motes: 1600,
      postprocessing: true,
      shadowMapSize: 2048,
      shadowRadius: 4,
      useExrEnvironment: true,
    });
  });

  it("uses direct rendering, 2048 shadows, and desktop HDRI on light mobile tier", () => {
    expect(resolveStageProfile("light", true)).toEqual({
      environmentDirectory: "desktop",
      landRings: 40,
      landSpokes: 80,
      motes: 1000,
      postprocessing: false,
      shadowMapSize: 2048,
      shadowRadius: 3,
      useExrEnvironment: true,
    });
  });

  it("uses direct rendering and 1024 shadows on low and plain tiers", () => {
    expect(resolveStageProfile("low", true)).toEqual({
      environmentDirectory: "phone",
      landRings: 28,
      landSpokes: 64,
      motes: 520,
      postprocessing: false,
      shadowMapSize: 1024,
      shadowRadius: 2,
      useExrEnvironment: true,
    });

    expect(resolveStageProfile("plain", false)).toEqual({
      environmentDirectory: "phone",
      landRings: 20,
      landSpokes: 48,
      motes: 260,
      postprocessing: false,
      shadowMapSize: 1024,
      shadowRadius: 2,
      useExrEnvironment: false,
    });
  });
});
