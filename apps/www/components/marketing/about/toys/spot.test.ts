import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, HashSet, Option } from "effect";
import { within } from "@/components/marketing/about/toys/place";
import { type GapSpot, gapSpots } from "@/components/marketing/about/toys/spot";

/** The box the layer measures for the part: 400 by 200, starting at 100, 100. */
const box = () => ({
  bottom: 300,
  height: 200,
  left: 100,
  right: 500,
  top: 100,
  width: 400,
});

/** A part of the page with an id, which lives only for one test. */
function part(id: string) {
  const element = document.createElement("section");
  element.id = id;
  document.body.append(element);
  return () => element.remove();
}

/** The keys of the spots, in their order. */
function keysOf(spots: readonly GapSpot[]) {
  return Arr.map(spots, (spot) => spot.key);
}

/** The keys of the spots that place a toy at this width of the page. */
function placedKeys(id: string, spots: readonly GapSpot[], width: number) {
  return keysOf(
    Arr.filter(spots, (spot) =>
      Option.isSome(within(id, spot.anchor)(width, box))
    )
  );
}

/** Where the spot with this key stands at this width, or null when it is left out. */
function standsAt(
  id: string,
  spots: readonly GapSpot[],
  key: string,
  width: number
) {
  const spot = Arr.findFirst(spots, (candidate) => candidate.key === key);
  return Option.getOrNull(
    Option.flatMap(spot, (found) => within(id, found.anchor)(width, box))
  );
}

describe("the spots of a gap", () => {
  it("stands the second animal at the far side of its part on a phone", () => {
    const remove = part("gap-far-side");
    const fromLeft = gapSpots(
      "gap-far-side",
      0.3,
      [7, 23],
      ["ruler", "highlighter"]
    );
    const fromRight = gapSpots(
      "gap-far-side",
      0.7,
      [7, 23],
      ["ruler", "highlighter"]
    );
    const key = "gap-far-side-gap-second-narrow";

    expect(standsAt("gap-far-side", fromLeft, key, 390)).toEqual({
      x: 100 + 0.88 * 400 - 28,
      y: 140,
    });
    expect(standsAt("gap-far-side", fromRight, key, 390)).toEqual({
      x: 100 + 0.12 * 400 - 28,
      y: 140,
    });
    remove();
  });

  it("places the wide spots from 1024 px and the narrow spots below it, while the first animal stands at every width", () => {
    const remove = part("gap-widths");
    const spots = gapSpots(
      "gap-widths",
      0.5,
      [7, 23],
      ["ruler", "highlighter"]
    );
    const keys = keysOf(spots);

    expect(placedKeys("gap-widths", spots, 1024)).toEqual(
      Arr.filter(keys, (key) => !key.endsWith("narrow"))
    );
    expect(placedKeys("gap-widths", spots, 1023)).toEqual(
      Arr.filter(keys, (key) => !key.endsWith("wide"))
    );
    remove();
  });

  it("keeps the narrow things of a gap inside the edges of its part", () => {
    const remove = part("gap-edges");
    const leftEdge = gapSpots("gap-edges", 0.02, [7, 23], ["ruler"]);
    const middle = gapSpots("gap-edges", 0.5, [7, 23], ["ruler"]);
    const rightEdge = gapSpots("gap-edges", 0.98, [7, 23], ["ruler"]);
    const key = "gap-edges-gap-ruler-narrow";

    expect(standsAt("gap-edges", leftEdge, key, 390)).toEqual({
      x: 100 + 0.12 * 400 - 24,
      y: 140,
    });
    expect(standsAt("gap-edges", middle, key, 390)).toEqual({
      x: 100 + 0.3 * 400 - 24,
      y: 140,
    });
    expect(standsAt("gap-edges", rightEdge, key, 390)).toEqual({
      x: 100 + 0.88 * 400 - 24,
      y: 140,
    });
    remove();
  });

  it("adds the second thing of a gap only when two things are given", () => {
    const one = gapSpots("gap-things", 0.5, [7, 23], ["calendar"]);
    const two = gapSpots("gap-things", 0.5, [7, 23], ["calendar", "globe"]);

    expect(keysOf(two)).toEqual([
      ...keysOf(one),
      "gap-things-gap-globe-wide",
      "gap-things-gap-globe-narrow",
    ]);
  });

  it("draws the first animal at its index, the second at its own, and each thing by its name", () => {
    const spots = gapSpots("gap-pictures", 0.5, [7, 23], ["calendar", "globe"]);

    expect(Arr.map(spots, (spot) => spot.picture)).toEqual([
      { index: 7, kind: "animal" },
      { index: 23, kind: "animal" },
      { index: 23, kind: "animal" },
      { kind: "thing", name: "calendar" },
      { kind: "thing", name: "calendar" },
      { kind: "thing", name: "globe" },
      { kind: "thing", name: "globe" },
    ]);
  });

  it("gives every spot of one gap its own key", () => {
    const keys = keysOf(
      gapSpots("gap-keys", 0.5, [7, 23], ["calendar", "globe"])
    );

    expect(HashSet.size(HashSet.fromIterable(keys))).toBe(keys.length);
  });
});
