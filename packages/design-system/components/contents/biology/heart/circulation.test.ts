// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  atriumDrive,
  contraction,
  steadyBeat,
  ventricleDrive,
} from "@repo/design-system/components/contents/biology/heart/circulation";
import { Array as Arr, Option } from "effect";

const highest = (values: readonly number[]) => Math.max(...values);
const lowest = (values: readonly number[]) => Math.min(...values);

describe("the heart's contraction", () => {
  it("times a resting beat as the model's sources do", () => {
    const { atrium, peak, rest } = contraction(0.8);
    expect(peak).toBeCloseTo(0.3 * Math.sqrt(0.8), 12);
    expect(rest).toBeCloseTo(1.5 * peak, 12);
    // OpenStax 19.3: atrial systole lasts about 100 ms of a 0.8 s beat.
    expect(0.8 - atrium).toBeCloseTo(0.1, 12);
  });

  it("shortens diastole far more than systole as the heart speeds up", () => {
    const slow = contraction(60 / 60);
    const fast = contraction(60 / 180);
    const systoleLost = slow.rest - fast.rest;
    const diastoleLost = 60 / 60 - slow.rest - (60 / 180 - fast.rest);
    expect(diastoleLost).toBeGreaterThan(2 * systoleLost);
  });

  it("drives the ventricle from rest to its peak and back", () => {
    const { peak, rest } = contraction(0.8);
    expect(ventricleDrive(0, 0.8)).toBe(0);
    expect(ventricleDrive(peak / 2, 0.8)).toBeCloseTo(1, 12);
    expect(ventricleDrive(peak, 0.8)).toBeCloseTo(2, 12);
    expect(ventricleDrive((peak + rest) / 2, 0.8)).toBeCloseTo(1, 12);
    expect(ventricleDrive(0.6, 0.8)).toBe(0);
  });

  it("drives the atrium only in the last eighth of the beat", () => {
    expect(atriumDrive(0.5, 0.8)).toBe(0);
    expect(atriumDrive(0.75, 0.8)).toBeCloseTo(2, 12);
    expect(atriumDrive(0.8, 0.8)).toBeCloseTo(0, 12);
  });
});

describe("one steady beat at rest", () => {
  const beat = steadyBeat(72, 240);
  const aorta = Arr.map(beat, (moment) => moment.aorta);
  const ventricle = Arr.map(beat, (moment) => moment.ventricle);
  const volume = Arr.map(beat, (moment) => moment.volume);
  const filled = Option.getOrThrow(
    Arr.findFirst(beat, (moment) => moment.volume === highest(volume))
  );

  it("records the beat from the start of ventricular contraction", () => {
    expect(beat).toHaveLength(240);
    expect(Arr.getUnsafe(beat, 0).time).toBe(0);
    expect(Arr.getUnsafe(beat, 239).time).toBeCloseTo(
      (60 / 72) * (239 / 240),
      9
    );
  });

  it("swings the aorta between about 120 and 80 mmHg", () => {
    // OpenStax 19.3 and 20.2: systolic about 120, diastolic about 80 mmHg.
    expect(highest(aorta)).toBeGreaterThan(115);
    expect(highest(aorta)).toBeLessThan(130);
    expect(lowest(aorta)).toBeGreaterThan(78);
    expect(lowest(aorta)).toBeLessThan(92);
  });

  it("peaks the ventricle with the aorta and fills it at a few mmHg", () => {
    expect(highest(ventricle)).toBeGreaterThan(highest(aorta));
    expect(highest(ventricle) - highest(aorta)).toBeLessThan(2);
    expect(filled.ventricle).toBeGreaterThan(5);
    expect(filled.ventricle).toBeLessThan(12);
  });

  it("fills to about 130 mL and empties to about 50 mL", () => {
    expect(highest(volume)).toBeGreaterThan(120);
    expect(highest(volume)).toBeLessThan(140);
    expect(lowest(volume)).toBeGreaterThan(45);
    expect(lowest(volume)).toBeLessThan(60);
  });

  it("never opens the mitral and aortic valves at once", () => {
    expect(
      Arr.every(beat, (moment) => moment.mitral === 0 || moment.aortic === 0)
    ).toBe(true);
  });

  it("ejects only while the ventricle pushes against the aorta", () => {
    const ejecting = Arr.filter(beat, (moment) => moment.outflow > 1);
    expect(ejecting.length).toBeGreaterThan(40);
    expect(
      Arr.every(ejecting, (moment) => moment.ventricle >= moment.aorta - 1)
    ).toBe(true);
  });

  it("fills only while the atrium stands above the ventricle", () => {
    const filling = Arr.filter(beat, (moment) => moment.inflow > 1);
    expect(
      Arr.every(filling, (moment) => moment.atrium >= moment.ventricle - 1)
    ).toBe(true);
  });
});

describe("a fast beat", () => {
  it("keeps the arterial pressure in range at 180 beats a minute", () => {
    const aorta = Arr.map(steadyBeat(180, 120), (moment) => moment.aorta);
    expect(lowest(aorta)).toBeGreaterThan(70);
    expect(highest(aorta)).toBeLessThan(150);
  });
});
