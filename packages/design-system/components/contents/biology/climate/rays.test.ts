// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  EARTH_RADIUS,
  infraredRays,
  SUN,
  sunBeams,
  wavePoints,
} from "@repo/design-system/components/contents/biology/climate/rays";
import { Array as Arr, Option } from "effect";

const length = (point: readonly [number, number, number]) =>
  Math.hypot(point[0], point[1], point[2]);

const distance = (
  a: readonly [number, number, number],
  b: readonly [number, number, number]
) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const stopped = (level: number) =>
  Arr.filter(infraredRays(level), (ray) => Option.isSome(ray.absorber)).length;

describe("the infrared rays", () => {
  it("are stopped more often as the gas level rises", () => {
    expect(Arr.map([1, 2, 3, 4, 5], stopped)).toEqual([1, 2, 4, 5, 6]);
    expect(infraredRays(3)).toHaveLength(7);
  });

  it("keeps every ray it stopped when the level rises", () => {
    const ids = (level: number) =>
      Arr.map(
        Arr.filter(infraredRays(level), (ray) => Option.isSome(ray.absorber)),
        (ray) => ray.id
      );
    expect(ids(5)).toEqual(expect.arrayContaining(ids(2)));
  });

  it("leaves the surface and escapes to space when nothing stops it", () => {
    const free = Arr.filter(infraredRays(1), (ray) =>
      Option.isNone(ray.absorber)
    );
    expect(free).toHaveLength(6);
    for (const ray of free) {
      const [only] = ray.segments;
      expect(ray.segments).toHaveLength(1);
      expect(length(only.start)).toBeCloseTo(EARTH_RADIUS);
      expect(length(only.end)).toBeCloseTo(1.8);
      expect(only.fades).toBe(true);
    }
  });

  it("is re-emitted from the molecule that stops it, down or outward", () => {
    const caught = Arr.filter(infraredRays(5), (ray) =>
      Option.isSome(ray.absorber)
    );
    const ends = Arr.map(caught, (ray) => {
      const [climb, onward] = ray.segments;
      const absorber = Option.getOrThrow(ray.absorber);
      expect(length(climb.start)).toBeCloseTo(EARTH_RADIUS);
      expect(climb.end).toEqual(absorber);
      expect(onward?.start).toEqual(absorber);
      expect(onward?.offset).toBeCloseTo(distance(climb.start, climb.end));
      return onward;
    });
    const down = Arr.filter(ends, (end) => end?.fades === false);
    const out = Arr.filter(ends, (end) => end?.fades === true);
    expect(down).toHaveLength(4);
    expect(out).toHaveLength(2);
    for (const end of down) {
      expect(length(end?.end ?? [0, 0, 0])).toBeCloseTo(EARTH_RADIUS);
    }
    for (const end of out) {
      expect(length(end?.end ?? [0, 0, 0])).toBeGreaterThan(EARTH_RADIUS);
    }
  });
});

describe("the sunbeams", () => {
  it("leave the Sun's disc and end on the surface", () => {
    const beams = sunBeams();
    expect(beams).toHaveLength(4);
    for (const beam of beams) {
      expect(length(beam.end)).toBeCloseTo(EARTH_RADIUS);
      expect(distance(beam.start, SUN.position)).toBeLessThan(SUN.radius * 2);
    }
  });
});

describe("a ribbon's wave", () => {
  it("starts and ends on its stretch and swings across it between", () => {
    const [ray] = infraredRays(1);
    const [stretch] = ray?.segments ?? [];
    const points = stretch === undefined ? [] : wavePoints(stretch);
    const first = Option.getOrThrow(Arr.head(points));
    const last = Option.getOrThrow(Arr.last(points));
    expect(distance(first, stretch?.start ?? first)).toBeCloseTo(0);
    expect(distance(last, stretch?.end ?? last)).toBeCloseTo(0);
    const swing = Arr.reduce(points, 0, (most, point) => {
      const share = distance(point, first) / distance(last, first);
      const along = Arr.map([0, 1, 2], (axis) => {
        const from = first[axis] ?? 0;
        return from + ((last[axis] ?? 0) - from) * share;
      });
      return Math.max(
        most,
        distance(point, [along[0] ?? 0, along[1] ?? 0, along[2] ?? 0])
      );
    });
    expect(swing).toBeGreaterThan(0.02);
    expect(swing).toBeLessThan(0.05);
  });

  it("samples a short stretch at least eight times", () => {
    expect(
      wavePoints({
        end: [0, 1, 0.01],
        fades: false,
        length: 0.01,
        offset: 0,
        start: [0, 1, 0],
      })
    ).toHaveLength(9);
  });
});
