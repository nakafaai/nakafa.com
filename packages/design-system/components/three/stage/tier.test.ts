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
      postprocessing: true,
      shadowMapSize: 2048,
      shadowRadius: 4,
      useExrEnvironment: true,
    });
  });

  it("uses direct rendering, 1024 shadows, and phone HDRI on light mobile tier", () => {
    expect(resolveStageProfile("light", true)).toEqual({
      environmentDirectory: "phone",
      postprocessing: false,
      shadowMapSize: 1024,
      shadowRadius: 2,
      useExrEnvironment: true,
    });
  });

  it("uses direct rendering and 512 shadows on low and plain tiers", () => {
    expect(resolveStageProfile("low", true)).toEqual({
      environmentDirectory: "phone",
      postprocessing: false,
      shadowMapSize: 512,
      shadowRadius: 1,
      useExrEnvironment: true,
    });

    expect(resolveStageProfile("plain", false)).toEqual({
      environmentDirectory: "phone",
      postprocessing: false,
      shadowMapSize: 512,
      shadowRadius: 1,
      useExrEnvironment: false,
    });
  });
});
