import { describe, expect, it } from "@effect/vitest";
import {
  buildLaminaGeometry,
  buildPlanterPotGeometry,
  buildRibbedFruitGeometry,
  buildSoilMoundGeometry,
  buildStemGeometry,
  laminaHalfWidth,
} from "@repo/design-system/components/contents/biology/botanical";
import { Vector3 } from "three";

const LEAF_SPEC = {
  baseTaper: 0.28,
  cols: 10,
  cup: 0.04,
  droop: 0.08,
  length: 0.5,
  midribCrease: 0.012,
  notchDepth: 0,
  rows: 14,
  ruffleAmp: 0.008,
  ruffleFreq: 5,
  serrationAmp: 0.08,
  serrationTeeth: 8,
  tipPower: 0.72,
  width: 0.24,
} as const;

const PETAL_SPEC = {
  baseTaper: -0.22,
  cols: 12,
  cup: 0.09,
  droop: -0.02,
  length: 0.48,
  midribCrease: 0.006,
  notchDepth: 0.06,
  rows: 16,
  ruffleAmp: 0.018,
  ruffleFreq: 7,
  serrationAmp: 0,
  serrationTeeth: 0,
  tipPower: 0.65,
  width: 0.34,
} as const;

describe("botanical lamina geometry", () => {
  it("computes positive half-widths with serration and smooth margins", () => {
    const midLeaf = laminaHalfWidth(0.5, LEAF_SPEC);
    const tipLeaf = laminaHalfWidth(1, LEAF_SPEC);
    const midPetal = laminaHalfWidth(0.5, PETAL_SPEC);

    expect(midLeaf).toBeGreaterThan(tipLeaf);
    expect(midPetal).toBeGreaterThan(0.5);
    expect(laminaHalfWidth(-0.2, LEAF_SPEC)).toBeGreaterThan(0);
  });

  it("builds UV-mapped serrated leaf and notched ruffled petal meshes", () => {
    const leaf = buildLaminaGeometry(LEAF_SPEC);
    const petal = buildLaminaGeometry(PETAL_SPEC);

    expect(leaf.getAttribute("position").count).toBe(15 * 11);
    expect(leaf.getAttribute("uv").count).toBe(15 * 11);
    expect(leaf.getAttribute("normal").count).toBe(15 * 11);
    expect(petal.getAttribute("position").count).toBe(17 * 13);

    leaf.dispose();
    petal.dispose();
  });
});

describe("botanical stem, fruit, pot, and soil builders", () => {
  it("builds tapering stems with and without swollen leaf-node collars", () => {
    const plain = buildStemGeometry(
      [new Vector3(0, 0, 0), new Vector3(0, 0.5, 0), new Vector3(0, 1, 0)],
      0.03,
      0.01,
      12,
      8
    );
    const stem = buildStemGeometry(
      [new Vector3(0, 0, 0), new Vector3(0.02, 0.5, 0), new Vector3(0, 1, 0)],
      0.04,
      0.018,
      16,
      10,
      [{ bulge: 0.35, t: 0.5, width: 0.06 }]
    );

    expect(plain.getAttribute("position").count).toBe(13 * 9);
    expect(stem.getAttribute("position").count).toBe(17 * 11);
    expect(stem.getAttribute("uv").count).toBe(17 * 11);
    plain.dispose();
    stem.dispose();
  });

  it("builds ribbed oblate fruit, rolled-lip planter pot, and clodded soil mound", () => {
    const fruit = buildRibbedFruitGeometry({
      height: 0.2,
      radialSegments: 24,
      radius: 0.12,
      ribDepth: 0.08,
      ribs: 6,
      rows: 16,
    });
    const pot = buildPlanterPotGeometry(0.22, 0.29, 0.28);
    const mound = buildSoilMoundGeometry(0.27, 0.055, 7);

    expect(fruit.getAttribute("position").count).toBe(17 * 25);
    expect(pot.getAttribute("position").count).toBeGreaterThan(100);
    expect(mound.getAttribute("position").count).toBeGreaterThan(100);

    fruit.dispose();
    pot.dispose();
    mound.dispose();
  });
});
