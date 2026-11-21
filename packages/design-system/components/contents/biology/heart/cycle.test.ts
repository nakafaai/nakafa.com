// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  cardiacOutput,
  heartBeat,
  momentAt,
  phaseOf,
  stageAt,
  strokeVolume,
  VolumesSchema,
  valveEvents,
} from "@repo/design-system/components/contents/biology/heart/cycle";
import { Array as Arr, Schema } from "effect";

const resting = { endDiastolic: 120, endSystolic: 50 };

describe("the volumes of the left ventricle", () => {
  const decode = Schema.decodeUnknownOption(VolumesSchema);

  it("keeps less blood than it filled with", () => {
    expect(decode(resting)._tag).toBe("Some");
    expect(decode({ endDiastolic: 50, endSystolic: 120 })._tag).toBe("None");
    expect(decode({ endDiastolic: 120, endSystolic: 0 })._tag).toBe("None");
  });

  it("pumps 70 mL a beat and 5.04 litres a minute at 72 beats", () => {
    // OpenStax 19.4: SV = EDV - ESV, CO = HR x SV.
    expect(strokeVolume(resting)).toBe(70);
    expect(cardiacOutput(resting, 72)).toBeCloseTo(5.04, 12);
  });
});

describe("one beat of this heart", () => {
  const beat = heartBeat(72, resting);
  const volume = Arr.map(beat.moments, (moment) => moment.volume);

  it("fills to the end-diastolic and empties to the end-systolic volume", () => {
    expect(Math.max(...volume)).toBeCloseTo(120, 9);
    expect(Math.min(...volume)).toBeCloseTo(50, 9);
    expect(beat.period).toBeCloseTo(60 / 72, 12);
    expect(beat.reserve.maximum).toBeGreaterThan(beat.reserve.minimum);
  });

  it("moves the valves in the order the pressures set", () => {
    const { atrium, close, open, refill, shut } = beat.events;
    expect(close).toBeLessThan(open);
    expect(open).toBeLessThan(shut);
    expect(shut).toBeLessThan(refill);
    expect(refill).toBeLessThan(atrium);
    expect(atrium).toBeLessThan(beat.period);
    // OpenStax 19.3: ventricular systole lasts about 270 ms of a resting beat.
    expect(shut - close).toBeGreaterThan(0.24);
    expect(shut - close).toBeLessThan(0.34);
  });

  it("names every stage of the cycle and its phase", () => {
    const { atrium, close, open, refill, shut } = beat.events;
    const stages = Arr.map(
      [
        close / 2,
        (close + open) / 2,
        (open + shut) / 2,
        (shut + refill) / 2,
        (refill + atrium) / 2,
        atrium,
      ],
      (time) => stageAt(beat.events, time)
    );
    expect(stages).toEqual([
      "atrial",
      "contraction",
      "ejection",
      "relaxation",
      "filling",
      "atrial",
    ]);
    expect(Arr.map(stages, phaseOf)).toEqual([
      "atrial",
      "ventricular",
      "ventricular",
      "diastole",
      "diastole",
      "atrial",
    ]);
  });

  it("reads the beat between moments and loops it", () => {
    const first = Arr.getUnsafe(beat.moments, 0);
    const second = Arr.getUnsafe(beat.moments, 1);
    const step = beat.period / beat.moments.length;
    const between = momentAt(beat, step / 2);
    expect(between.aorta).toBeCloseTo((first.aorta + second.aorta) / 2, 9);
    expect(momentAt(beat, beat.period + step).volume).toBeCloseTo(
      second.volume,
      9
    );
    expect(momentAt(beat, -beat.period + step).time).toBeCloseTo(step, 9);
  });

  it("keeps the last event of a heart whose valves never move", () => {
    const still = Arr.map(beat.moments, (moment) => ({
      ...moment,
      aortic: 0,
      mitral: 1,
    }));
    expect(valveEvents(still, beat.period)).toEqual({
      atrium: beat.events.atrium,
      close: 0,
      open: 0,
      refill: 0,
      shut: 0,
    });
  });
});

describe("a faster heart", () => {
  it("spends a larger share of each beat in systole", () => {
    const rest = heartBeat(72, resting);
    const fast = heartBeat(150, resting);
    const share = (beat: typeof rest) => beat.events.shut / beat.period;
    expect(share(fast)).toBeGreaterThan(share(rest) + 0.1);
  });
});
