import { describe, expect, it } from "@effect/vitest";
import {
  COVER_SPAN,
  LAWN_TONES,
  layCover,
  linearTone,
  paintCover,
  SWARD_SHADER,
} from "@repo/design-system/components/three/stage/cover";
import { Array as Arr } from "effect";
import { Texture, Vector2 } from "three";

/** One channel of a painted cover, pixel by pixel. */
function channel(pixels: Uint8ClampedArray, offset: number) {
  return Arr.makeBy(pixels.length / 4, (pixel) =>
    Number(pixels[pixel * 4 + offset])
  );
}

describe("paintCover", () => {
  const size = 48;
  const pixels = paintCover(size);

  it("paints the same lawn on every visit", () => {
    expect(pixels).toEqual(paintCover(size));
    expect(pixels).toHaveLength(size * size * 4);
  });

  it("grows thick over most of the lawn and wears through to soil in patches", () => {
    const thick = channel(pixels, 0);
    const bare = Arr.filter(thick, (value) => value < 20).length;
    const grown = Arr.filter(thick, (value) => value > 170).length;

    expect(bare).toBeGreaterThan(0);
    expect(bare).toBeLessThan(thick.length * 0.3);
    expect(grown).toBeGreaterThan(thick.length * 0.5);
  });

  it("dries in places, carries clover only where grass grows, and varies in height", () => {
    const dry = channel(pixels, 1);
    const clover = channel(pixels, 2);
    const tall = channel(pixels, 3);
    const thick = channel(pixels, 0);

    expect(Math.max(...dry)).toBeGreaterThan(200);
    expect(Math.min(...dry)).toBe(0);
    expect(Math.max(...clover)).toBeGreaterThan(100);
    expect(Arr.filter(clover, (value) => value === 0).length).toBeGreaterThan(
      clover.length * 0.5
    );
    expect(
      Arr.every(
        clover,
        (value, pixel) => value === 0 || Number(thick[pixel]) > 0
      )
    ).toBe(true);
    expect(Math.min(...tall)).toBeGreaterThan(80);
    expect(Math.max(...tall) - Math.min(...tall)).toBeGreaterThan(40);
  });
});

describe("linearTone", () => {
  it("turns sRGB bytes into the linear tone a shader lights", () => {
    const [red, green, blue] = linearTone([255, 5, 128]);

    expect(red).toBeCloseTo(1, 6);
    expect(green).toBeCloseTo(5 / 255 / 12.92, 6);
    expect(blue).toBeCloseTo(0.2158, 3);
  });
});

describe("layCover", () => {
  it("lays the lawn's tone, thatch and bare soil on a ground's program", () => {
    const sward = {
      uCover: { value: new Texture() },
      uFlat: { value: 9 },
      uFocus: { value: new Vector2(1, 2) },
      uPressed: { value: new Texture() },
      uRadius: { value: 7 },
    };
    const program = {
      fragmentShader:
        "#include <common>\nvoid main() {\n#include <roughnessmap_fragment>\n}",
      uniforms: {},
    };
    layCover(program, sward);

    expect(program.uniforms).toEqual(sward);
    expect(program.fragmentShader).toContain(SWARD_SHADER);
    expect(program.fragmentShader).toContain(
      "diffuseColor.rgb *= mix(SWARD_SOIL, swardGrass, swardGrown);"
    );
    expect(program.fragmentShader).toContain(
      "#include <roughnessmap_fragment>\nvec4 swardHere"
    );
  });

  it("names the lawn's tones and the span of its cover for the shader", () => {
    expect(SWARD_SHADER).toContain(
      `const vec3 SWARD_LUSH = vec3(${linearTone(LAWN_TONES.lush).join(", ")});`
    );
    expect(SWARD_SHADER).toContain(`place / ${COVER_SPAN.toFixed(4)}`);
  });
});
