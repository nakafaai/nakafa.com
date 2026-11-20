// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  HOOP,
  hoopCentres,
  letterPlaces,
  MAT,
  type Place,
  regionAt,
  regionSpots,
  restingPlaces,
  SPACING,
  TRAY,
  TRAY_Z,
  trayPlaces,
  UNIVERSE_PLACE,
} from "@repo/design-system/components/contents/mathematics/venn/layout";
import { Array as Arr } from "effect";

/** Whether no two places stand closer than `gap`. */
function apart(places: readonly Place[], gap: number) {
  return Arr.every(places, (place, index) =>
    Arr.every(
      Arr.drop(places, index + 1),
      (other) => Math.hypot(place.x - other.x, place.z - other.z) >= gap - 1e-9
    )
  );
}

describe("the hoops on the mat", () => {
  it("lays two or three hoops inside the mat, overlapping into every region", () => {
    for (const sets of [2, 3]) {
      const centres = hoopCentres(sets);
      expect(centres).toHaveLength(sets);
      for (const centre of centres) {
        expect(Math.abs(centre.x) + HOOP.radius).toBeLessThan(MAT.width / 2);
        expect(Math.abs(centre.z) + HOOP.radius).toBeLessThan(MAT.depth / 2);
      }
      for (const region of Arr.range(0, 2 ** sets - 1)) {
        expect(regionSpots(region, centres, SPACING).length).toBeGreaterThan(0);
      }
    }
  });

  it("finds the region of a place from the hoops around it", () => {
    const centres = hoopCentres(2);
    expect(regionAt({ x: 0, z: 0 }, centres)).toBe(3);
    expect(regionAt({ x: -0.5, z: 0 }, centres)).toBe(1);
    expect(regionAt({ x: 0.5, z: 0 }, centres)).toBe(2);
    expect(regionAt({ x: 0, z: 0.6 }, centres)).toBe(0);
  });

  it("prints each hoop's letter outside every hoop, on the mat", () => {
    for (const sets of [2, 3]) {
      const centres = hoopCentres(sets);
      for (const letter of letterPlaces(centres)) {
        expect(regionAt(letter, centres)).toBe(0);
        expect(Math.abs(letter.x)).toBeLessThan(MAT.width / 2);
        expect(Math.abs(letter.z)).toBeLessThan(MAT.depth / 2);
      }
    }
    expect(regionAt(UNIVERSE_PLACE, hoopCentres(3))).toBe(0);
  });

  it("keeps a letter straight out when no turn finds room on the mat", () => {
    const [crowded] = letterPlaces([
      { x: 0.9, z: 0.7 },
      { x: -0.9, z: -0.7 },
    ]);
    expect(crowded?.x).toBeGreaterThan(MAT.width / 2);
    expect(crowded?.z).toBeGreaterThan(MAT.depth / 2);
  });
});

describe("where the objects rest", () => {
  it("keeps every region's places apart, inside it and clear of the tubes", () => {
    const centres = hoopCentres(3);
    for (const region of Arr.range(0, 7)) {
      const spots = regionSpots(region, centres, SPACING);
      expect(apart(spots, SPACING)).toBe(true);
      for (const spot of spots) {
        expect(regionAt(spot, centres)).toBe(region);
        for (const centre of centres) {
          const fromTube = Math.abs(
            Math.hypot(spot.x - centre.x, spot.z - centre.z) - HOOP.radius
          );
          expect(fromTube).toBeGreaterThanOrEqual(HOOP.tube + 0.044);
        }
      }
    }
  });

  it("gives each object a place of its own region", () => {
    const centres = hoopCentres(2);
    const regions = [3, 1, 0, 3, 2, 0, 1];
    const places = restingPlaces(regions, centres);
    expect(places).toHaveLength(regions.length);
    expect(apart(places, SPACING)).toBe(true);
    expect(Arr.map(places, (place) => regionAt(place, centres))).toEqual(
      regions
    );
  });

  it("packs a crowded region closer rather than spill it into another", () => {
    const centres = hoopCentres(3);
    const usual = regionSpots(3, centres, SPACING).length;
    const regions = Arr.makeBy(usual + 2, () => 3);
    const places = restingPlaces(regions, centres);
    expect(apart(places, SPACING * 0.75)).toBe(true);
    for (const place of places) {
      expect(regionAt(place, centres)).toBe(3);
    }
  });

  it("piles an impossible crowd on the last place instead of failing", () => {
    const centres = hoopCentres(3);
    const places = restingPlaces(
      Arr.makeBy(40, () => 7),
      centres
    );
    expect(places).toHaveLength(40);
    const [beforeLast, last] = Arr.takeRight(places, 2);
    expect(last).toEqual(beforeLast);
  });

  it("waits the objects on the tray in rows of five", () => {
    const places = trayPlaces(13);
    expect(places).toHaveLength(13);
    expect(apart(places, SPACING)).toBe(true);
    for (const place of places) {
      expect(Math.abs(place.x)).toBeLessThan(TRAY.width / 2 - 0.04);
      expect(Math.abs(place.z - TRAY_Z)).toBeLessThan(TRAY.depth / 2 - 0.04);
    }
  });
});
