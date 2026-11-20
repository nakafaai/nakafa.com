// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  bands,
  CAPILLARY,
  clearance,
  crowding,
  demand,
  effort,
  flow,
  force,
  lactic,
  RELAXED,
  RUN,
  repaid,
  SHORTENED,
  sarcomere,
  shortfall,
  stageAt,
  THICK,
  trace,
  uptake,
} from "@repo/design-system/components/contents/biology/muscle/debt";
import { Array as Arr } from "effect";

/** The lesson's runner: resting at 0.3 L/min, exercise needing 2 L/min more, the slider reaching 2.5. */
const REST = 0.3;
const WORK = 2;
const MOST = 2.5;

/** A trapezoid sum of `rate` from `from` to `to`, to check the closed forms against. */
function integral(rate: (minute: number) => number, from: number, to: number) {
  const steps = 20_000;
  const width = (to - from) / steps;
  return Arr.reduce(
    Arr.range(0, steps - 1),
    0,
    (sum, step) =>
      sum +
      ((rate(from + step * width) + rate(from + (step + 1) * width)) / 2) *
        width
  );
}

describe("oxygen uptake through exercise and recovery", () => {
  it("rests, climbs towards demand, and falls back on the lesson's curves", () => {
    expect(stageAt(1)).toBe("rest");
    expect(stageAt(RUN.start)).toBe("exercise");
    expect(stageAt(RUN.end)).toBe("exercise");
    expect(stageAt(12)).toBe("recovery");
    expect(uptake(1, REST, WORK)).toBe(REST);
    expect(uptake(3, REST, WORK)).toBeCloseTo(0.3 + 2 * (1 - Math.exp(-1)), 12);
    expect(uptake(8, REST, WORK)).toBeCloseTo(2.295_04, 5);
    expect(uptake(10, REST, WORK)).toBeCloseTo(
      0.3 + 2 * (1 - Math.exp(-6)) * Math.exp(-1),
      12
    );
    expect(demand(5, REST, WORK)).toBe(2.3);
    expect(demand(12, REST, WORK)).toBe(REST);
  });

  it("measures the shortfall as the area between demand and uptake", () => {
    const gap = (minute: number) =>
      demand(minute, REST, WORK) - uptake(minute, REST, WORK);
    expect(shortfall(1, WORK)).toBe(0);
    expect(shortfall(5, WORK)).toBeCloseTo(integral(gap, 2, 5), 6);
    expect(shortfall(RUN.end, WORK)).toBeCloseTo(2 * (1 - Math.exp(-6)), 12);
    expect(shortfall(14, WORK)).toBe(shortfall(RUN.end, WORK));
  });

  it("measures the debt as the uptake above rest after exercise, larger than the shortfall", () => {
    const extra = (minute: number) => uptake(minute, REST, WORK) - REST;
    expect(repaid(6, WORK)).toBe(0);
    expect(repaid(11, WORK)).toBeCloseTo(integral(extra, 8.000_001, 11), 5);
    expect(repaid(RUN.close, WORK)).toBeCloseTo(
      2 * WORK * (1 - Math.exp(-6)) * (1 - Math.exp(-4)),
      12
    );
    expect(repaid(20, WORK)).toBe(repaid(RUN.close, WORK));
    expect(repaid(RUN.close, WORK)).toBeGreaterThan(shortfall(RUN.end, WORK));
  });
});

describe("lactic acid and fatigue", () => {
  it("builds lactic acid with the shortfall and clears it as the debt is repaid", () => {
    expect(lactic(1, WORK, MOST)).toBe(0);
    expect(lactic(RUN.end, MOST, MOST)).toBe(1);
    expect(lactic(RUN.end, WORK, MOST)).toBeCloseTo(0.8, 12);
    expect(lactic(4, WORK, MOST)).toBeLessThan(lactic(6, WORK, MOST));
    expect(lactic(12, WORK, MOST)).toBeLessThan(lactic(RUN.end, WORK, MOST));
    expect(lactic(RUN.close, WORK, MOST)).toBeCloseTo(0, 12);
  });

  it("clears lactic acid only in recovery, at the rate its level falls", () => {
    expect(clearance(5, REST, WORK, MOST)).toBe(0);
    const rate = clearance(10, REST, WORK, MOST);
    const fall =
      (lactic(9.999, WORK, MOST) - lactic(10.001, WORK, MOST)) / 0.002;
    expect(rate).toBeCloseTo(fall, 5);
  });

  it("weakens the fibres by up to a quarter of their force", () => {
    expect(force(0)).toBe(1);
    expect(force(1)).toBe(0.75);
  });
});

describe("sarcomeres in contraction", () => {
  it("shortens from relaxed to the lab's peak, less when fatigued", () => {
    expect(sarcomere(0, 1)).toBe(RELAXED);
    expect(sarcomere(1, 1)).toBe(SHORTENED);
    expect(sarcomere(1, 0.75)).toBeCloseTo(2.325, 12);
  });

  it("narrows the I band and closes the H zone while the A band keeps its width", () => {
    const relaxed = bands(RELAXED);
    const contracted = bands(SHORTENED);
    expect(relaxed.i).toBeCloseTo(RELAXED - THICK, 12);
    expect(relaxed.h).toBeCloseTo(0.14, 12);
    expect(contracted.i).toBeCloseTo(0.55, 12);
    expect(contracted.h).toBe(0);
  });
});

describe("blood flow", () => {
  it("speeds the red cells from the resting to the working speed as uptake rises", () => {
    expect(effort(1, REST, WORK, MOST)).toBe(0);
    expect(flow(1, REST, WORK, MOST)).toBe(CAPILLARY.rest.speed);
    expect(flow(RUN.end, REST, MOST, MOST)).toBeCloseTo(
      CAPILLARY.work.speed,
      0
    );
    expect(flow(10, REST, WORK, MOST)).toBeGreaterThan(CAPILLARY.rest.speed);
  });

  it("packs the cells closer as flux rises faster than speed", () => {
    expect(1 / crowding(1, REST, WORK, MOST)).toBeCloseTo(12.05, 1);
    expect(1 / crowding(RUN.end, REST, MOST, MOST)).toBeCloseTo(9.66, 1);
  });

  it("samples the uptake curve across the whole run", () => {
    const points = trace(REST, WORK, 32);
    expect(points).toHaveLength(33);
    expect(points[0]).toEqual({ minute: 0, uptake: REST });
    expect(points[16]?.minute).toBe(RUN.end);
  });
});
