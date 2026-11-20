// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  potentialAt,
  RISE,
} from "@repo/design-system/components/contents/biology/neuron/conduction";
import {
  arrival,
  CUT,
  ELECTRODE,
  END,
  realTime,
  shownAt,
  spacing,
  timeline,
} from "@repo/design-system/components/contents/biology/neuron/playback";

const myelinated = { diameter: 12, myelinated: true, name: "A alpha" };
const bare = { diameter: 1, myelinated: false, name: "C" };

describe("where the impulse is", () => {
  it("jumps one internode every 1/60 ms whatever the myelinated fibre's width", () => {
    expect(spacing(myelinated)).toBe(1200);
    expect(arrival(myelinated, 1, 1)).toBeCloseTo(1 / 60, 12);
    expect(arrival({ ...myelinated, diameter: 20 }, 1, 1)).toBeCloseTo(
      1 / 60,
      12
    );
  });

  it("reaches the terminals after the whole length, whatever the drawing leaves out", () => {
    expect(arrival(myelinated, 1, END)).toBeCloseTo(1000 / 72, 12);
    expect(arrival(myelinated, 1, CUT)).toBeCloseTo(CUT / 60, 12);
    expect(arrival(myelinated, 0.001, END)).toBeCloseTo(
      (END * 1200) / 72_000,
      12
    );
  });
});

describe("the run the scene plays", () => {
  it("rests, crosses the near stretch in slow motion, and loops", () => {
    const run = timeline(myelinated, 1);
    expect(realTime(run, 0)).toBeLessThan(0);
    expect(realTime(run, 0.8)).toBeCloseTo(0, 12);
    expect(realTime(run, 0.8 + 1 / 6)).toBeCloseTo(1 / 60, 12);
    expect(realTime(run, run.period + 0.8)).toBeCloseTo(0, 9);
  });

  it("fast-forwards through the cut and comes out where the impulse emerges", () => {
    const run = timeline(myelinated, 1);
    const cut = 0.8 + run.parts.near;
    expect(realTime(run, cut)).toBeCloseTo(run.leave, 9);
    expect(realTime(run, cut + run.parts.gap / 2)).toBeGreaterThan(run.leave);
    expect(realTime(run, cut + run.parts.gap)).toBeCloseTo(run.emerge, 6);
    expect(run.emerge).toBeLessThan(run.end);
  });

  it("plays the far stretch slowly, then the recovery, then rests", () => {
    const run = timeline(bare, 1);
    const far = 0.8 + run.parts.near + run.parts.gap;
    expect(realTime(run, far + 1)).toBeCloseTo(run.emerge + 0.1, 9);
    expect(realTime(run, far + run.parts.far + 0.5)).toBeGreaterThan(run.end);
    expect(realTime(run, run.period - 0.01)).toBeCloseTo(run.end + 6, 9);
  });

  it("shows a bare fibre crawling where a myelinated one jumps", () => {
    expect(timeline(bare, 1).parts.near).toBeGreaterThan(
      5 * timeline(myelinated, 1).parts.near
    );
  });

  it("finds the displayed moment of any real time in each part of the run", () => {
    const run = timeline(myelinated, 1);
    for (const real of [-0.5, 0.03, 1, 13.87, 15, 25]) {
      expect(realTime(run, shownAt(run, real))).toBeCloseTo(
        Math.min(real, run.end + 6),
        9
      );
    }
  });

  it("stills the frame as the membrane under the electrode peaks", () => {
    for (const fibre of [myelinated, bare]) {
      const run = timeline(fibre, 1);
      const local = realTime(run, run.still) - arrival(fibre, 1, ELECTRODE);
      expect(local).toBeCloseTo(RISE, 9);
      expect(potentialAt(local)).toBeGreaterThan(25);
    }
  });
});
