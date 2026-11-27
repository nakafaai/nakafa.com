import { describe, expect, it } from "@effect/vitest";
import {
  landGeometry,
  landHeight,
  ringShare,
  SITE_GROUND,
  SITE_RISES,
} from "@repo/design-system/components/contents/physics/renewable-energy/wind/land";
import { Array as Arr } from "effect";

const HILL = SITE_RISES.hill[0].land;
const BEACH = SITE_RISES.coast[0];

describe("landHeight", () => {
  it("is level on the plateau, where the turbine's foundation stands", () => {
    expect(landHeight(HILL, 0, 0)).toBeCloseTo(0, 9);
    expect(landHeight(HILL, 0.2, -0.2)).toBeCloseTo(0, 9);
  });

  it("falls by the drop to the rim and stays there beyond it", () => {
    expect(landHeight(HILL, HILL.radius, 0)).toBeCloseTo(-HILL.drop, 9);
    expect(landHeight(HILL, 0, 2 * HILL.radius)).toBeCloseTo(-HILL.drop, 9);
    expect(landHeight(HILL, 3, 1)).toBeLessThan(0);
    expect(landHeight(HILL, 3, 1)).toBeGreaterThan(-HILL.drop);
  });
});

describe("the sites", () => {
  it("keep the turbine's foot on level land above the plain and the sea", () => {
    expect(landHeight(BEACH.land, -BEACH.at[0], -BEACH.at[2])).toBeCloseTo(
      0,
      9
    );
    expect(SITE_GROUND.coast.sea).toBeLessThan(0);
    expect(SITE_GROUND.coast.sea).toBeGreaterThan(-BEACH.land.drop);
  });

  it("bring the hill down to the plain it stands on, a hair under it so the two never part", () => {
    const [hill, plain] = SITE_RISES.hill;
    const foot = hill.at[1] - hill.land.drop;
    expect(foot).toBeLessThan(plain.at[1]);
    expect(plain.at[1] - foot).toBeLessThan(0.01);
    expect(plain.land.radius).toBeGreaterThan(10 * hill.land.radius - 1);
  });

  it("put the sea between the coast's turbine and the wind", () => {
    const upwind = landHeight(BEACH.land, 2 - BEACH.at[0], 4.5 - BEACH.at[2]);
    expect(upwind).toBeLessThan(SITE_GROUND.coast.sea);
  });

  it("bury the foot of each valley ridge under the valley floor", () => {
    for (const ridge of Arr.take(SITE_RISES.valley, 2)) {
      expect(ridge.at[1] - ridge.land.drop).toBeLessThan(0);
      expect(Math.hypot(ridge.at[0], ridge.at[2])).toBeGreaterThan(
        ridge.land.radius
      );
    }
  });
});

describe("ringShare", () => {
  it("spends a quarter of the rings on the plateau and the rest on the slope", () => {
    expect(ringShare(BEACH.land, 0)).toBe(0);
    expect(ringShare(BEACH.land, 14)).toBeCloseTo(BEACH.land.plateau, 9);
    expect(ringShare(BEACH.land, 7)).toBeCloseTo(BEACH.land.plateau / 2, 9);
    expect(ringShare(BEACH.land, 35)).toBeCloseTo(
      BEACH.land.plateau + (1 - BEACH.land.plateau) / 2,
      9
    );
    expect(ringShare(BEACH.land, 56)).toBeCloseTo(1, 9);
  });
});

describe("landGeometry", () => {
  it("meshes a rise that looks up, with its texture laid where the stage lays its ground's", () => {
    const geometry = landGeometry(SITE_RISES.hill[0], 144);
    const normal = geometry.getAttribute("normal");
    const uv = geometry.getAttribute("uv");
    geometry.computeBoundingBox();
    expect(normal.getY(14 * 129)).toBeGreaterThan(0.99);
    expect(normal.getY(35 * 129 + 7)).toBeGreaterThan(0.5);
    expect(geometry.boundingBox?.max.x).toBeCloseTo(HILL.radius, 6);
    expect([uv.getX(0), uv.getY(0)]).toEqual([0.5, 0.5]);
    expect(uv.getX(56 * 129)).toBeCloseTo(0.5 + HILL.radius / 144, 6);
  });

  it("lays the texture of a rise that stands off the middle from the middle all the same", () => {
    const uv = landGeometry(BEACH, 144).getAttribute("uv");
    expect(uv.getX(0)).toBeCloseTo(0.5 + BEACH.at[0] / 144, 6);
    expect(uv.getY(0)).toBeCloseTo(0.5 - BEACH.at[2] / 144, 6);
  });
});
