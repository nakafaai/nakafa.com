import { describe, expect, it } from "@effect/vitest";
import {
  layGround,
  layKey,
} from "@repo/design-system/components/three/stage/shader";
import { Texture } from "three";

/** The parts of a standard material's program that a ground rewrites. */
function program() {
  return {
    fragmentShader:
      "#include <common>\nvoid main() {\n#include <map_fragment>\n#include <dithering_fragment>\n}",
    uniforms: {},
    vertexShader:
      "#include <common>\nvoid main() {\n#include <worldpos_vertex>\n}",
  };
}

describe("layGround", () => {
  it("dissolves a surface between two radii around the origin", () => {
    const plain = program();
    layGround(plain, { inner: 3, outer: 12 });

    expect(plain.uniforms).toEqual({
      uHorizonInner: { value: 3 },
      uHorizonOuter: { value: 12 },
    });
    expect(plain.vertexShader).toContain(
      "vHorizonWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;"
    );
    expect(plain.fragmentShader).toContain("gl_FragColor.a *= horizonSmooth;");
    expect(plain.fragmentShader).toContain("#include <dithering_fragment>");
    expect(plain.fragmentShader).not.toContain("uSweep");
  });

  it("lays a sweep's colour by each pixel's place in the world", () => {
    const swept = program();
    const texture = new Texture();
    layGround(swept, { inner: 3, outer: 12, sweep: { span: [4, 8], texture } });

    expect(swept.uniforms).toMatchObject({
      uSweep: { value: texture },
      uSweepScale: { value: [0.25, 0.125] },
    });
    expect(swept.fragmentShader).toContain(
      "diffuseColor.rgb *= texture2D(uSweep, vHorizonWorldPos.xz * uSweepScale).rgb;"
    );
    expect(swept.fragmentShader).toContain("gl_FragColor.a *= horizonSmooth;");
  });
});

describe("layKey", () => {
  it("names a program by its radii and its sweep", () => {
    const sweep = { span: [1, 1] as const, texture: new Texture() };
    const other = { span: [1, 1] as const, texture: new Texture() };

    expect(layKey({ inner: 3, outer: 12, sweep })).toBe(
      layKey({ inner: 3, outer: 12, sweep })
    );
    expect(layKey({ inner: 3, outer: 12, sweep })).not.toBe(
      layKey({ inner: 3, outer: 12, sweep: other })
    );
    expect(layKey({ inner: 3, outer: 12, sweep })).not.toBe(
      layKey({ inner: 3, outer: 12 })
    );
    expect(layKey({ inner: 3, outer: 12 })).not.toBe(
      layKey({ inner: 4, outer: 12 })
    );
  });
});
