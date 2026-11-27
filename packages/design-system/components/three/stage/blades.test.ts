import { describe, expect, it } from "@effect/vitest";
import {
  BLADE_HEIGHT,
  BLADES,
  bladeMesh,
  focusOn,
  layBlades,
  scatterBlades,
} from "@repo/design-system/components/three/stage/blades";
import { Array as Arr, Record } from "effect";
import { Texture, Vector2 } from "three";

describe("bladeMesh", () => {
  it("builds a blade that narrows from its foot to one vertex at its tip", () => {
    const { indices, shape } = bladeMesh(3);

    expect(shape).toHaveLength(14);
    expect(Arr.fromIterable(shape.subarray(0, 4))).toEqual([-1, 0, 1, 0]);
    expect(Arr.fromIterable(shape.subarray(12))).toEqual([0, 1]);
    expect(Number(shape[10])).toBeLessThan(Number(shape[6]));
    expect(indices).toEqual([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6]);
    expect(Math.max(...indices)).toBe(6);
  });
});

describe("scatterBlades", () => {
  const count = 600;
  const span = 8;
  const { roots, traits } = scatterBlades(count, span, 3);

  it("scatters the same blades on every device, all inside the square", () => {
    expect(scatterBlades(count, span, 3).roots).toEqual(roots);
    expect(scatterBlades(count, span, 4).roots).not.toEqual(roots);
    for (let blade = 0; blade < count; blade += 1) {
      expect(Number(roots[blade * 4])).toBeGreaterThanOrEqual(0);
      expect(Number(roots[blade * 4])).toBeLessThan(span);
      expect(Number(roots[blade * 4 + 1])).toBeGreaterThanOrEqual(0);
      expect(Number(roots[blade * 4 + 1])).toBeLessThan(span);
    }
  });

  it("gives every blade its own height, turn, lean, tint and width", () => {
    for (let blade = 0; blade < count; blade += 1) {
      expect(Number(roots[blade * 4 + 2])).toBeGreaterThanOrEqual(0.45);
      expect(Number(roots[blade * 4 + 2])).toBeLessThanOrEqual(1);
      expect(Number(roots[blade * 4 + 3])).toBeLessThan(2 * Math.PI);
      expect(Number(traits[blade * 4])).toBeGreaterThanOrEqual(0.15);
      expect(Number(traits[blade * 4])).toBeLessThanOrEqual(0.9);
      expect(Number(traits[blade * 4 + 3])).toBeGreaterThanOrEqual(0.7);
      expect(Number(traits[blade * 4 + 3])).toBeLessThan(1.3);
    }
    expect(
      Arr.dedupe(Arr.makeBy(count, (blade) => Number(traits[blade * 4 + 1])))
        .length
    ).toBeGreaterThan(count * 0.95);
  });

  it("grows most blades in tufts and the rest alone", () => {
    const near = Arr.filter(
      Arr.makeBy(count - 1, (blade) =>
        Math.hypot(
          Number(roots[blade * 4]) - Number(roots[blade * 4 + 4]),
          Number(roots[blade * 4 + 1]) - Number(roots[blade * 4 + 5])
        )
      ),
      (apart) => apart < 0.08
    ).length;

    expect(near).toBeGreaterThan(count * 0.15);
    expect(near).toBeLessThan(count * 0.6);
  });
});

describe("BLADES", () => {
  it("draws fewer, broader blades over a smaller patch on a weaker device", () => {
    expect(Record.keys(BLADES)).toEqual(["full", "light", "low", "plain"]);
    expect(BLADES.full.count).toBeGreaterThan(BLADES.light.count);
    expect(BLADES.light.count).toBeGreaterThan(BLADES.low.count);
    expect(BLADES.low.count).toBeGreaterThan(BLADES.plain.count);
    expect(BLADES.plain.width).toBeGreaterThan(BLADES.full.width);
    expect(BLADES.plain.radius).toBeLessThan(BLADES.full.radius);
    expect(BLADE_HEIGHT).toBeLessThan(0.15);
  });
});

describe("focusOn", () => {
  const half = Math.PI / 8;

  it("stands where a steep view looks", () => {
    const out = focusOn(
      { x: 0, y: 0 },
      [0, 4, 4],
      [0, -Math.SQRT1_2, -Math.SQRT1_2],
      half,
      0,
      7,
      0.5
    );

    expect(out.x).toBeCloseTo(0, 6);
    expect(out.y).toBeCloseTo(0, 6);
  });

  it("stays near the bottom of the frame when the view looks far away", () => {
    const shallow = Math.atan2(1, 20);
    const out = focusOn(
      { x: 0, y: 0 },
      [0, 2, 0],
      [Math.cos(shallow), -Math.sin(shallow), 0],
      half,
      0,
      5,
      0.25
    );

    expect(out.x).toBeGreaterThan(4);
    expect(out.x).toBeLessThan(12);
    expect(out.y).toBeCloseTo(0, 6);
  });

  it("lies ahead of a level view, and under a view that looks straight down", () => {
    const level = focusOn(
      { x: 0, y: 0 },
      [1, 1.5, 1],
      [0, 0, 1],
      half,
      0,
      5,
      1
    );
    const down = focusOn({ x: 0, y: 0 }, [3, 6, -2], [0, -1, 0], half, 1, 5, 1);

    expect(level.x).toBe(1);
    expect(level.y).toBeGreaterThan(5);
    expect(down).toEqual({ x: 3, y: -2 });
  });
});

describe("layBlades", () => {
  it("rewrites a standard program to place, bend and tone every blade", () => {
    const growth = {
      uBlade: { value: BLADE_HEIGHT },
      uCover: { value: new Texture() },
      uFlat: { value: 9 },
      uFocus: { value: new Vector2() },
      uPixel: { value: 0.001 },
      uPressed: { value: new Texture() },
      uRadius: { value: 7 },
      uTime: { value: 0 },
      uWidth: { value: 0.012 },
    };
    const program = {
      fragmentShader:
        "#include <common>\nvoid main() {\n#include <color_fragment>\n#include <normal_fragment_begin>\n}",
      uniforms: {},
      vertexShader:
        "#include <common>\nvoid main() {\n#include <beginnormal_vertex>\n#include <begin_vertex>\n}",
    };
    layBlades(program, growth);

    expect(program.uniforms).toEqual(growth);
    expect(program.vertexShader).toContain(
      "float windAt(vec2 place, float time)"
    );
    expect(program.vertexShader).toContain("vec4 swardCover(vec2 place)");
    expect(program.vertexShader).toContain("vec3 transformed = bladeAt;");
    expect(program.vertexShader).not.toContain("#include <beginnormal_vertex>");
    expect(program.fragmentShader).toContain(
      "diffuseColor.rgb = vBladeTone * mix(0.58, 1.0, vBladeAlong);"
    );
    expect(program.fragmentShader).toContain("normal = normalize(vNormal);");
  });
});
