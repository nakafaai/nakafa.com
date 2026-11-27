import { describe, expect, it } from "@effect/vitest";
import type { Blade } from "@repo/design-system/components/three/flora/blade";
import {
  bladeMesh,
  bladeWidth,
  veinAt,
} from "@repo/design-system/components/three/flora/blade";
import { Array as Arr, Option } from "effect";

/** A flat, smooth-edged blade with nothing to bend or groove it. */
const FLAT: Blade = {
  arch: 0,
  columns: 4,
  fold: 0,
  length: 2,
  outline: "elliptic",
  relief: 0,
  rows: 6,
  teeth: 0,
  veins: 5,
  wave: 0,
  width: 1,
};

/** The numbers of a mesh in threes. */
function triples(values: readonly number[]) {
  return Arr.map(Arr.chunksOf(values, 3), ([x, y, z]) => ({
    x: Number(x),
    y: Number(y),
    z: Number(z),
  }));
}

describe("bladeWidth", () => {
  it("closes at the stalk and the tip and is widest at the belly", () => {
    expect(bladeWidth("ovate", 0)).toBe(0);
    expect(bladeWidth("ovate", 1)).toBe(0);
    expect(bladeWidth("ovate", 0.34)).toBeCloseTo(1);
    expect(bladeWidth("ovate", -1)).toBe(0);
    expect(bladeWidth("ovate", 2)).toBe(0);
  });

  it("puts the belly of an obovate blade nearer its tip than an ovate one's", () => {
    expect(bladeWidth("obovate", 0.7)).toBeGreaterThan(
      bladeWidth("ovate", 0.7)
    );
    expect(bladeWidth("ovate", 0.3)).toBeGreaterThan(
      bladeWidth("obovate", 0.3)
    );
  });
});

describe("veinAt", () => {
  it("is strongest on the midrib, strong on a side vein and absent between veins", () => {
    expect(veinAt(0.5, 0, 7)).toBeCloseTo(1);
    expect(veinAt(0.17 + 3 / 7, 0.5, 7)).toBeGreaterThan(0.4);
    expect(veinAt(0.17 + 3.5 / 7, 0.5, 7)).toBeLessThan(0.01);
  });
});

describe("bladeMesh", () => {
  it("lays a grid from the stalk at the origin to the tip, face up", () => {
    const mesh = bladeMesh(FLAT);
    const places = triples(mesh.positions);

    expect(places).toHaveLength(7 * 5);
    expect(mesh.indices).toHaveLength(6 * 4 * 6);
    expect(places[0]?.x).toBe(0);
    expect(Option.getOrUndefined(Arr.last(places))?.x).toBe(2);
    for (const normal of triples(mesh.normals)) {
      expect(normal.y).toBeCloseTo(1);
    }
  });

  it("presses the veins into the blade as real relief", () => {
    const places = triples(bladeMesh({ ...FLAT, relief: 0.05 }).positions);

    expect(Number(places[3 * 5 + 2]?.y)).toBeLessThan(-0.04);
    expect(Math.max(...Arr.map(places, (place) => place.y))).toBeLessThan(1e-9);
  });

  it("folds, arches, waves and tooths a living leaf", () => {
    const leaf = triples(
      bladeMesh({ ...FLAT, arch: 0.3, fold: 0.4, teeth: 5, wave: 0.2 })
        .positions
    );
    const flat = triples(bladeMesh(FLAT).positions);

    expect(
      Number(Option.getOrUndefined(Arr.get(leaf, leaf.length - 3))?.y)
    ).toBeLessThan(-0.5);
    expect(Number(leaf[3 * 5]?.y)).toBeGreaterThan(0);
    expect(Math.abs(Number(leaf[2 * 5]?.z))).toBeLessThan(
      Math.abs(Number(flat[2 * 5]?.z))
    );
  });

  it("carries the lobes of a heart-shaped base back past the stalk and notches a heart-shaped tip", () => {
    const heart = triples(bladeMesh({ ...FLAT, outline: "cordate" }).positions);
    const notched = triples(
      bladeMesh({ ...FLAT, outline: "obcordate" }).positions
    );

    expect(Math.min(...Arr.map(heart, (place) => place.x))).toBeLessThan(-0.2);
    expect(
      Number(Option.getOrUndefined(Arr.get(notched, notched.length - 3))?.x)
    ).toBeLessThan(Number(Option.getOrUndefined(Arr.last(notched))?.x));
  });
});
