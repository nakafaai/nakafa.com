// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  BARE,
  flowAt,
  gates,
  potentialAt,
  REST,
  SPIKE,
  speed,
  THRESHOLD,
  travel,
} from "@repo/design-system/components/contents/biology/neuron/conduction";
import { Array as Arr, Option } from "effect";

const myelinated = { diameter: 12, myelinated: true, name: "A alpha" };
const bare = { diameter: 1, myelinated: false, name: "C" };

describe("impulse speed", () => {
  it("grows 6 m/s for every micrometre of a myelinated fibre", () => {
    expect(speed(myelinated)).toBe(72);
    expect(speed({ ...myelinated, diameter: 10 })).toBe(60);
  });

  it("grows with the square root of a bare fibre's diameter, through the squid axon", () => {
    expect(speed({ ...bare, diameter: 476 })).toBeCloseTo(21.2, 12);
    expect(speed(bare)).toBeCloseTo(BARE, 12);
    expect(BARE).toBeCloseTo(0.97, 2);
    expect(speed({ ...bare, diameter: 4 })).toBeCloseTo(2 * BARE, 12);
  });

  it("takes about 14 ms over a metre of myelinated fibre and about a second bare", () => {
    expect(travel(1, myelinated)).toBeCloseTo(1000 / 72, 12);
    expect(travel(1, bare)).toBeCloseTo(1000 / BARE, 9);
  });
});

describe("the action potential", () => {
  const samples = Arr.fromIterable(SPIKE.potential);
  const peak = Arr.reduce(samples, Number.NEGATIVE_INFINITY, (most, sample) =>
    Math.max(most, sample)
  );
  const top = Option.getOrThrow(
    Arr.findFirstIndex(samples, (sample) => sample === peak)
  );
  const trough = Arr.reduce(
    Arr.drop(samples, top),
    Number.POSITIVE_INFINITY,
    (least, sample) => Math.min(least, sample)
  );

  it("rests at -70 mV before the local current arrives", () => {
    expect(potentialAt(-1)).toBe(REST);
    expect(potentialAt(0)).toBeCloseTo(REST, 9);
  });

  it("passes the -55 mV threshold about 0.15 ms after the local current arrives", () => {
    expect(potentialAt(0.1)).toBeLessThan(THRESHOLD);
    expect(potentialAt(0.2)).toBeGreaterThan(THRESHOLD);
  });

  it("peaks near +30 mV, undershoots to about -80 mV and settles back to rest", () => {
    expect(peak).toBeGreaterThan(25);
    expect(peak).toBeLessThan(40);
    expect(top * 0.01).toBeLessThan(0.6);
    expect(trough).toBeGreaterThan(-82);
    expect(trough).toBeLessThan(-78);
    expect(potentialAt(1.3)).toBeLessThan(REST);
    expect(potentialAt(100)).toBeCloseTo(REST, 0);
  });

  it("lets sodium in on the rise and potassium out on the fall", () => {
    const rise = flowAt(top * 0.01 - 0.1);
    const fall = flowAt(top * 0.01 + 0.3);
    expect(rise.sodium).toBeGreaterThan(rise.potassium);
    expect(fall.potassium).toBeGreaterThan(fall.sodium);
    expect(flowAt(0.1).local).toBe(1);
    expect(flowAt(0.3).local).toBe(0);
    expect(flowAt(-1)).toEqual({ local: 0, potassium: 0, sodium: 0 });
  });

  it("keeps the gate rates finite where their formulas divide by zero", () => {
    expect(gates(-55).n.opening).toBeCloseTo(0.1, 12);
    expect(gates(-40).m.opening).toBeCloseTo(1, 12);
    expect(gates(-55.0001).n.opening).toBeCloseTo(0.1, 5);
  });
});
