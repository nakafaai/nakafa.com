// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  boreAt,
  filterOf,
  glassOf,
  levelOf,
  liquidOf,
  scaleOf,
  volumeTo,
} from "@repo/design-system/components/three/apparatus/glass";
import { Array as Arr, Option } from "effect";

const plain = (value: number, digits: number) => value.toFixed(digits);
const beaker = { capacity: 250, kind: "beaker" } as const;
const conical = { capacity: 250, kind: "conical" } as const;

describe("the glass of a vessel", () => {
  it("is a 250 mL low form beaker at its catalogue size, with a spout", () => {
    const glass = glassOf(beaker);
    expect(glass.height).toBeCloseTo(0.095, 3);
    expect(glass.outline[2]?.[0]).toBeCloseTo(0.035, 3);
    expect(glass.wall).toBeCloseTo(0.0019, 4);
    expect(glass.base).toBeCloseTo(glass.wall * 1.5);
    expect(glass.spout).toBe(true);
    expect(glass.outline[0]).toEqual([0, 0]);
  });

  it("is a 250 mL conical flask at its catalogue size, with no spout", () => {
    const glass = glassOf(conical);
    expect(glass.height).toBeCloseTo(0.14, 2);
    expect(glass.outline[2]?.[0]).toBeCloseTo(0.0425, 3);
    expect(glass.spout).toBe(false);
  });

  it("keeps one shape at every size", () => {
    const small = glassOf({ capacity: 100, kind: "beaker" });
    const large = glassOf({ capacity: 800, kind: "beaker" });
    expect(large.height / small.height).toBeCloseTo(2);
  });
});

describe("the space inside a vessel", () => {
  it("is the vessel less its wall, and narrows up a conical flask", () => {
    const glass = glassOf(beaker);
    expect(boreAt(beaker, 0.05)).toBeCloseTo(
      (glass.outline[2]?.[0] ?? 0) - glass.wall - 0.000_15,
      9
    );
    expect(boreAt(conical, 0.11)).toBeLessThan(boreAt(conical, 0.03));
  });

  it("is held at the vessel's ends below its base and above its rim", () => {
    expect(boreAt(beaker, -1)).toBeCloseTo(boreAt(beaker, 0));
    expect(boreAt(beaker, 1)).toBeCloseTo(boreAt(beaker, 0.095));
  });
});

describe("how much a vessel holds", () => {
  it("holds its nominal capacity with room to spare below the rim", () => {
    const brim = volumeTo(beaker, glassOf(beaker).height);
    expect(brim).toBeGreaterThan(250);
    expect(brim).toBeLessThan(350);
    expect(volumeTo(conical, glassOf(conical).height)).toBeGreaterThan(250);
  });

  it("holds nothing at its floor", () => {
    expect(volumeTo(beaker, 0)).toBe(0);
  });

  it("stands a volume at the height that holds it", () => {
    const level = levelOf(beaker, 120);
    expect(volumeTo(beaker, level)).toBeCloseTo(120, 3);
    expect(volumeTo(conical, levelOf(conical, 100))).toBeCloseTo(100, 3);
  });

  it("stands at its floor when empty and at its rim when overfilled", () => {
    expect(levelOf(beaker, 0)).toBeCloseTo(glassOf(beaker).base, 6);
    expect(levelOf(beaker, 9000)).toBeCloseTo(glassOf(beaker).height, 6);
  });
});

describe("the liquid in a vessel", () => {
  const liquid = liquidOf(conical, 150);
  const level = levelOf(conical, 150);

  it("lies on the floor and closes on the axis at its level", () => {
    expect(liquid[0]).toEqual([0, glassOf(conical).base]);
    expect(Option.getOrThrow(Arr.last(liquid))).toEqual([0, level]);
  });

  it("climbs the glass in a meniscus and is flat where a level is read", () => {
    const radius = boreAt(conical, level);
    const wet = Arr.findFirst(liquid, ([across]) => across === radius);
    expect(Option.getOrThrow(wet)).toEqual([radius, level + 0.0018]);
    expect(
      Option.getOrThrow(Arr.get(liquid, liquid.length - 2))[1]
    ).toBeCloseTo(level);
  });

  it("follows the wall below its level", () => {
    expect(
      Arr.every(
        liquid,
        ([across, height]) =>
          across <= boreAt(conical, Math.min(height, level)) + 1e-9
      )
    ).toBe(true);
  });
});

describe("what a liquid lets through", () => {
  const blue = [0.07, 0.29, 0.58] as const;

  it("lets through its thin colour across one layer, and less across more", () => {
    expect(filterOf(blue, 20, 0.05)).toEqual([0.07, 0.29, 0.58]);
    const deep = filterOf(blue, 20, 0.1);
    expect(deep[0]).toBeCloseTo(0.0049);
    expect(deep[2]).toBeCloseTo(0.3364);
  });

  it("lets all the light through across no width or with no strength", () => {
    expect(filterOf(blue, 20, -1)).toEqual([1, 1, 1]);
    expect(filterOf(blue, -3, 0.05)).toEqual([1, 1, 1]);
  });
});

describe("the scale fired on a vessel", () => {
  const scale = scaleOf(conical, "white", plain);
  const lines = Arr.filter(scale.sheet.marks, (mark) => mark.kind === "line");
  const texts = Arr.filter(scale.sheet.marks, (mark) => mark.kind === "text");

  it("numbers every fifth of the capacity and writes the capacity above", () => {
    expect(Arr.map(texts, (mark) => mark.text)).toEqual([
      "50",
      "100",
      "150",
      "200",
      "250 mL",
    ]);
  });

  it("stands each mark at the height the vessel holds that volume", () => {
    expect((lines[1]?.from[1] ?? 0) + scale.middle).toBeCloseTo(
      levelOf(conical, 100),
      6
    );
  });

  it("draws the marks of a conical flask apart toward its neck", () => {
    const gaps = Arr.zipWith(
      lines,
      Arr.drop(lines, 1),
      (low, high) => high.from[1] - low.from[1]
    );
    expect(gaps[2]).toBeGreaterThan(gaps[0] ?? 0);
  });

  it("leans with a conical wall and stands upright on a beaker", () => {
    expect(scale.lean).toBeGreaterThan(0.1);
    expect(scale.radius).toBeLessThan(0.0425);
    expect(scaleOf(beaker, "white", plain).lean).toBe(0);
  });
});
