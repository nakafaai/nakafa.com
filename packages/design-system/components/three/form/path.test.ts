import { describe, expect, it } from "@effect/vitest";
import type { Point } from "@repo/design-system/components/three/form/path";
import {
  arcThrough,
  legAt,
  lengthOf,
  placeOn,
  pointOn,
  rideOn,
  sideOf,
  size,
  squareTo,
  sub,
  trackOf,
  unit,
} from "@repo/design-system/components/three/form/path";
import { Array as Arr } from "effect";
import { Vector3 } from "three";

/** The places of a track, as points. */
function placesOf(track: ReturnType<typeof trackOf>) {
  return Arr.makeBy(
    track.lengths.length,
    (index): Point => [
      track.places[index * 3],
      track.places[index * 3 + 1],
      track.places[index * 3 + 2],
    ]
  );
}

/** How near a track comes to a point. */
function nearest(track: ReturnType<typeof trackOf>, point: Point) {
  return Math.min(
    ...Arr.map(placesOf(track), (place) => size(sub(place, point)))
  );
}

describe("trackOf a curve through points", () => {
  it("passes through every point and measures a straight line exactly", () => {
    const bent: Point[] = [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [2, 1, 0.5],
    ];
    const track = trackOf(bent);
    for (const point of bent) {
      expect(nearest(track, point)).toBeLessThan(1e-9);
    }
    expect(lengthOf(track)).toBeGreaterThan(3);

    const straight = trackOf([
      [0, 0, 0],
      [0, 1, 0],
      [0, 3, 0],
    ]);
    expect(straight.lengths).toHaveLength(3);
    expect(lengthOf(straight)).toBeCloseTo(3, 12);
  });

  it("samples a tight turn finely and drops a point drawn twice", () => {
    const hairpin = trackOf([
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 0],
      [0, 0.1, 0],
    ]);
    expect(hairpin.lengths.length).toBeGreaterThan(20);
    expect(Arr.every(Arr.fromIterable(hairpin.places), Number.isFinite)).toBe(
      true
    );
  });
});

describe("trackOf a pipe run", () => {
  it("rounds a corner into an arc of the bend's radius", () => {
    const track = trackOf({
      bend: 0.2,
      kind: "route",
      points: [
        [0, 0, 0],
        [1, 0, 0],
        [1, 1, 0],
      ],
    });
    expect(lengthOf(track)).toBeCloseTo(2 - 0.4 + (Math.PI * 0.2) / 2, 4);
    const centre: Point = [0.8, 0.2, 0];
    const arc = Arr.filter(
      placesOf(track),
      (place) => place[0] > 0.8 && place[1] < 0.2
    );
    expect(arc.length).toBeGreaterThan(8);
    for (const place of arc) {
      expect(size(sub(place, centre))).toBeCloseTo(0.2, 9);
    }
  });

  it("never cuts more than half of a leg, and runs straight between two points", () => {
    const tight = trackOf({
      bend: 5,
      kind: "route",
      points: [
        [0, 0, 0],
        [1, 0, 0],
        [1, 0.4, 0],
        [2, 0.4, 0],
      ],
    });
    expect(nearest(tight, [1, 0.2, 0])).toBeLessThan(1e-9);
    const leg = trackOf({
      bend: 0.1,
      kind: "route",
      points: [
        [0, 0, 0],
        [0, 0, 2],
      ],
    });
    expect(leg.lengths).toHaveLength(2);
    expect(lengthOf(leg)).toBe(2);
  });
});

describe("arcThrough", () => {
  it("keeps a corner that does not turn, or doubles back, as a point", () => {
    const through = arcThrough([0, 0, 0], [1, 0, 0], [2, 0, 0], 0.2, 4);
    expect(through).toHaveLength(2);
    expect(through[0].place).toEqual([1, 0, 0]);
    const back = arcThrough([0, 0, 0], [1, 0, 0], [0, 0, 0], 0.2, 4);
    expect(back[0].heading).toEqual([1, 0, 0]);
    expect(back[1].heading).toEqual([-1, 0, 0]);
  });

  it("leaves one leg and joins the next heading the way each runs", () => {
    const arc = arcThrough([0, 0, 0], [1, 0, 0], [1, 1, 0], 0.25, 6);
    expect(arc).toHaveLength(7);
    expect(arc[0].place[0]).toBeCloseTo(0.75, 12);
    expect(arc[0].heading[0]).toBeCloseTo(1, 12);
    expect(arc[6].place[1]).toBeCloseTo(0.25, 12);
    expect(arc[6].heading[1]).toBeCloseTo(1, 12);
  });
});

describe("trackOf a coil", () => {
  it("winds at its radius around its axis from one end to the other", () => {
    const track = trackOf({
      from: [0, 1, 0],
      kind: "helix",
      radius: 0.5,
      to: [0, 3, 0],
      turns: 4,
    });
    const places = placesOf(track);
    for (const [x, , z] of places) {
      expect(Math.hypot(x, z)).toBeCloseTo(0.5, 2);
    }
    expect(places[0]).toEqual([0.5, 1, 0]);
    expect(Arr.lastNonEmpty(places)[1]).toBeCloseTo(3, 12);
    expect(lengthOf(track)).toBeCloseTo(
      Math.hypot(2, 4 * 2 * Math.PI * 0.5),
      2
    );
  });

  it("winds the other way for negative turns, starts at its phase, and runs through its leads", () => {
    const left = trackOf({
      from: [0, 0, 0],
      kind: "helix",
      radius: 1,
      to: [0, 1, 0],
      turns: 1,
    });
    const right = trackOf({
      from: [0, 0, 0],
      kind: "helix",
      radius: 1,
      to: [0, 1, 0],
      turns: -1,
    });
    expect(placesOf(left)[3][2]).toBeGreaterThan(0);
    expect(placesOf(right)[3][2]).toBeLessThan(0);

    const led = trackOf({
      from: [0, 0, 0],
      kind: "helix",
      lead: [[3, -1, 0]],
      phase: Math.PI / 2,
      radius: 1,
      tail: [[3, 2, 0]],
      to: [0, 1, 0],
      turns: 0.01,
    });
    expect(placesOf(led)[0]).toEqual([3, -1, 0]);
    expect(Arr.lastNonEmpty(placesOf(led))).toEqual([3, 2, 0]);
    expect(nearest(led, [0, 0, 1])).toBeLessThan(1e-9);
  });

  it("winds a leaning coil square to its own axis", () => {
    const axis = unit([1, -0.4, 0]);
    const track = trackOf({
      from: [0, 0, 0],
      kind: "helix",
      radius: 0.1,
      to: [1, -0.4, 0],
      turns: 2,
    });
    expect(placesOf(track)[0][2]).toBeCloseTo(0.1, 12);
    for (const place of placesOf(track)) {
      const along = place[0] * axis[0] + place[1] * axis[1];
      const foot: Point = [along * axis[0], along * axis[1], 0];
      expect(size(sub(place, foot))).toBeCloseTo(0.1, 2);
    }
  });
});

describe("placeOn", () => {
  const track = trackOf({
    bend: 0,
    kind: "route",
    points: [
      [0, 0, 0],
      [2, 0, 0],
      [2, 2, 0],
    ],
  });

  it("moves a target a share of the way along the track", () => {
    const target = new Vector3();
    placeOn(track, 0.25, target);
    expect(target.toArray()).toEqual([1, 0, 0]);
    placeOn(track, 0.75, target);
    expect(target.x).toBeCloseTo(2, 12);
    expect(target.y).toBeCloseTo(1, 12);
  });

  it("holds the ends for a share outside the track", () => {
    const target = new Vector3();
    placeOn(track, -1, target);
    expect(target.toArray()).toEqual([0, 0, 0]);
    placeOn(track, 4, target);
    expect(target.toArray()).toEqual([2, 2, 0]);
  });

  it("gives the same place as a point, for a part's first position", () => {
    expect(pointOn(track, 0.25)).toEqual([1, 0, 0]);
    expect(pointOn(track, 7)).toEqual([2, 2, 0]);
  });

  it("moves a row of riders, each its share ahead and round again past the end", () => {
    const riders = [
      { position: new Vector3() },
      { position: new Vector3() },
      { position: new Vector3() },
    ];
    rideOn(track, riders, [0, 0.5], 0.75);
    expect(riders[0].position.y).toBeCloseTo(1, 12);
    expect(riders[1].position.toArray()).toEqual([1, 0, 0]);
    expect(riders[2].position.toArray()).toEqual([0, 0, 0]);
  });

  it("finds the leg a distance lies on", () => {
    expect(legAt(track, 3).share).toBeCloseTo(0.5, 12);
    expect(legAt(track, 3).from).toBe(track.lengths.length - 2);
  });
});

describe("sideOf", () => {
  it("faces the world axis a heading is least aligned with, x before z before y", () => {
    expect(sideOf([0, 1, 0])).toEqual([1, 0, 0]);
    expect(sideOf([1, 0, 0])).toEqual([0, 0, 1]);
    expect(sideOf(unit([1, 0, 1]))).toEqual([0, 1, 0]);
  });

  it("leans a section toward a direction as far as its heading allows", () => {
    const side = squareTo([1, 0, 0], [1, 1, 0]);
    expect(side[0]).toBeCloseTo(0, 12);
    expect(side[1]).toBeCloseTo(1, 12);
  });
});
