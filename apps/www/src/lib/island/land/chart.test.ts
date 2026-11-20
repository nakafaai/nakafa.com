// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import type { Thing } from "@repo/backend/confect/island/things";
import { Array as Arr, HashSet, MutableHashMap, Option, Order } from "effect";
import { applyChanges, thingTo } from "@/lib/island/land/changes";
import { chartOf } from "@/lib/island/land/chart";
import type { Land } from "@/lib/island/land/ground";
import { landOf } from "@/lib/island/land/ground";
import { homeOf } from "@/lib/island/land/home";
import { pointOf, SEA } from "@/lib/island/land/relief";
import { spotOf } from "@/lib/island/land/site";

const SEED = 4242;

/** The place every world of the seed opens on, which the chart is drawn about. */
const HOME = homeOf(SEED);

/** How far the chart reaches either way of its middle, in blocks, and how many pixels it is on a side. */
const REACH = 400;
const SIDE = 64;
const STEP = (REACH * 2) / SIDE;

/** How high one terrace stands over the one below it, in blocks (ADR 0050, W1). */
const TERRACE = 6;

/** What kind of place a sample of the land is, as a chart tells them apart. */
function kindOf(point: ReturnType<typeof pointOf>) {
  const deep = point.surface - point.height;
  if (deep > 0) {
    if (point.surface > SEA + 0.02) {
      return "fresh";
    }
    if (deep < 1.2) {
      return "shoal";
    }
    return deep < 4 ? "sea" : "deep";
  }
  if (point.sand > 0.5) {
    return "beach";
  }
  if (point.forest > 0.55) {
    return "forest";
  }
  return point.meadow > 0.5 ? "meadow" : "grass";
}

/** The seed's land under every pixel of the chart, row by row from the north. */
const SAMPLES = Arr.makeBy(SIDE * SIDE, (at) => {
  const point = pointOf(
    SEED,
    HOME[0] - REACH + ((at % SIDE) + 0.5) * STEP,
    HOME[1] - REACH + (Math.floor(at / SIDE) + 0.5) * STEP
  );
  return {
    kind: kindOf(point),
    terrace: Math.max(0, Math.floor((point.height - SEA) / TERRACE)),
    top: Math.max(point.height, point.surface),
  };
});

/** Whether the land east or south of a pixel stands a cliff's height over it. */
function underCliff(at: number) {
  const east = at % SIDE < SIDE - 1 ? SAMPLES[at + 1].top : SAMPLES[at].top;
  const south =
    at + SIDE < SIDE * SIDE ? SAMPLES[at + SIDE].top : SAMPLES[at].top;
  return Math.max(east, south) - SAMPLES[at].top > 2.5;
}

/** The ink of one pixel of a chart, as text. */
function inkAt(pixels: Uint8ClampedArray, at: number) {
  return `${pixels[at * 4]},${pixels[at * 4 + 1]},${pixels[at * 4 + 2]}`;
}

/** The inks the chart draws the pixels of one kind of place in, off every cliff, on one terrace when one is asked for. */
function inksOf(
  pixels: Uint8ClampedArray,
  kind: ReturnType<typeof kindOf>,
  terrace: Option.Option<number>
) {
  return HashSet.fromIterable(
    Arr.getSomes(
      Arr.map(SAMPLES, (sample, at) =>
        sample.kind === kind &&
        !underCliff(at) &&
        Option.match(terrace, {
          onNone: () => true,
          onSome: (wanted) => sample.terrace === wanted,
        })
          ? Option.some(inkAt(pixels, at))
          : Option.none()
      )
    )
  );
}

/** The one ink a set of pixels shares, as red, green and blue; the test fails where they share none. */
function oneInk(inks: HashSet.HashSet<string>) {
  expect(HashSet.size(inks)).toBe(1);
  return Arr.map(Arr.fromIterable(inks)[0].split(","), Number);
}

/** Sets a thing down at a place without asking the land. */
function stand(land: Land, kind: Thing, x: number, z: number) {
  const spot = spotOf(x, z);
  applyChanges(land, [
    thingTo(
      land,
      spot.cx,
      spot.cz,
      spot.at,
      Option.some({ at: spot.at, kind, turn: 0 })
    ),
  ]);
}

describe("island/land/chart", () => {
  it("draws every pixel opaque from the seed alone, making none of the land", () => {
    const land = landOf(SEED);
    const pixels = chartOf(land, HOME, REACH, SIDE);
    expect(pixels).toHaveLength(SIDE * SIDE * 4);
    expect(
      Arr.every(
        Arr.range(0, SIDE * SIDE - 1),
        (at) => pixels[at * 4 + 3] === 255
      )
    ).toBe(true);
    expect(MutableHashMap.size(land.chunks)).toBe(0);
    expect(chartOf(landOf(SEED), HOME, REACH, SIDE)).toEqual(pixels);
  });

  it("draws water in one ink for each depth, bluer than anything on land, and darker the deeper it lies", () => {
    const pixels = chartOf(landOf(SEED), HOME, REACH, SIDE);
    const none = Option.none<number>();
    const [shoal, sea, deep, fresh] = Arr.map(
      ["shoal", "sea", "deep", "fresh"] as const,
      (kind) => oneInk(inksOf(pixels, kind, none))
    );
    for (const water of [shoal, sea, deep, fresh]) {
      expect(water[2]).toBeGreaterThan(water[1]);
      expect(water[1]).toBeGreaterThan(water[0]);
    }
    expect(shoal[2]).toBeGreaterThan(sea[2]);
    expect(sea[2]).toBeGreaterThan(deep[2]);
    expect(fresh).not.toEqual(sea);
    expect(fresh).not.toEqual(shoal);
  });

  it("draws land by what covers it: a pale beach, green grass, a lighter meadow and a darker wood", () => {
    const pixels = chartOf(landOf(SEED), HOME, REACH, SIDE);
    const first = Option.some(0);
    const [beach, grass, meadow, forest] = Arr.map(
      ["beach", "grass", "meadow", "forest"] as const,
      (kind) => oneInk(inksOf(pixels, kind, first))
    );
    for (const green of [grass, meadow, forest]) {
      expect(green[1]).toBeGreaterThan(green[0]);
      expect(green[1]).toBeGreaterThan(green[2]);
    }
    expect(beach[0]).toBeGreaterThan(beach[1]);
    expect(beach[1]).toBeGreaterThan(beach[2]);
    expect(meadow[1]).toBeGreaterThan(grass[1]);
    expect(grass[1]).toBeGreaterThan(forest[1]);
  });

  it("draws each terrace above the first lighter than the one below it", () => {
    const pixels = chartOf(landOf(SEED), HOME, REACH, SIDE);
    const terraces = Arr.sort(
      Arr.dedupe(
        Arr.getSomes(
          Arr.map(SAMPLES, (sample, at) =>
            sample.kind === "grass" && !underCliff(at)
              ? Option.some(sample.terrace)
              : Option.none()
          )
        )
      ),
      Order.Number
    );
    expect(terraces.length).toBeGreaterThan(2);
    // One ink a terrace, each with more light in it than the one below: its green is the first to reach all a pixel holds, so the light is summed over the three.
    const lights = Arr.map(terraces, (terrace) =>
      Arr.reduce(
        oneInk(inksOf(pixels, "grass", Option.some(terrace))),
        0,
        (sum, channel) => sum + channel
      )
    );
    expect(lights).toEqual(Arr.sort(Arr.dedupe(lights), Order.Number));
  });

  it("draws a cliff as a line along its lower side, in an ink of its own", () => {
    const pixels = chartOf(landOf(SEED), HOME, REACH, SIDE);
    const under = Arr.filter(Arr.range(0, SIDE * SIDE - 1), underCliff);
    expect(under.length).toBeGreaterThan(10);
    const cliff = HashSet.fromIterable(
      Arr.map(under, (at) => inkAt(pixels, at))
    );
    const [red, green, blue] = oneInk(cliff);
    expect(
      Math.max(red, green, blue) - Math.min(red, green, blue)
    ).toBeLessThan(16);
    const rest = HashSet.fromIterable(
      Arr.map(
        Arr.filter(Arr.range(0, SIDE * SIDE - 1), (at) => !underCliff(at)),
        (at) => inkAt(pixels, at)
      )
    );
    expect(HashSet.size(HashSet.intersection(rest, cliff))).toBe(0);
  });

  it("marks each thing the learner set down inside the chart with a dot, and none that stands outside it", () => {
    const land = landOf(SEED);
    const before = chartOf(land, HOME, REACH, SIDE);
    stand(land, "campfire", HOME[0], HOME[1]);
    stand(land, "bench", HOME[0] - REACH + 1, HOME[1] + REACH - 1);
    stand(land, "lantern", HOME[0] + 100.5, HOME[1] - 200);
    stand(land, "bench", HOME[0] - REACH - 30, HOME[1]);
    stand(land, "bench", HOME[0] + REACH + 30, HOME[1]);
    stand(land, "bench", HOME[0], HOME[1] - REACH - 30);
    stand(land, "bench", HOME[0], HOME[1] + REACH + 30);
    const after = chartOf(land, HOME, REACH, SIDE);
    const dots = Arr.filter(
      Arr.range(0, SIDE * SIDE - 1),
      (at) => inkAt(after, at) !== inkAt(before, at)
    );
    expect(dots).toEqual([
      (SIDE / 2 - 16) * SIDE + SIDE / 2 + 8,
      (SIDE / 2) * SIDE + SIDE / 2,
      (SIDE - 1) * SIDE,
    ]);
    const dot = HashSet.fromIterable(Arr.map(dots, (at) => inkAt(after, at)));
    expect(HashSet.size(dot)).toBe(1);
    expect(
      Arr.some(Arr.range(0, SIDE * SIDE - 1), (at) =>
        HashSet.has(dot, inkAt(before, at))
      )
    ).toBe(false);
  });

  it("draws a closer chart of the same land at a finer step", () => {
    const land = landOf(SEED);
    stand(land, "campfire", HOME[0] + 30, HOME[1] + 30);
    const wide = chartOf(land, HOME, REACH, SIDE);
    const close = chartOf(land, [HOME[0] + 30, HOME[1] + 30], 40, 16);
    expect(close).toHaveLength(16 * 16 * 4);
    // The thing in the middle of the close chart is the dot a little south-east of the wide chart's middle.
    expect(inkAt(close, 8 * 16 + 8)).toBe(
      inkAt(wide, (SIDE / 2 + 2) * SIDE + SIDE / 2 + 2)
    );
  });
});
