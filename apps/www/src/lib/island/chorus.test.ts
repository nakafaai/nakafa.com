// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option, Order } from "effect";
import { callOf, crowsAt, voicesOf } from "@/lib/island/chorus";

/** Open grass far from everything, with no roof near. */
const OPEN = {
  fall: 0,
  fire: 0,
  forest: 0,
  fresh: 0,
  meadow: 0,
  river: 0,
  roof: 0,
  sea: 0,
};

/** The calls of two hundred seeds at a place by day or by night. */
function calls(place: typeof OPEN, night: boolean) {
  return Arr.getSomes(Arr.makeBy(200, (seed) => callOf(seed, place, night)));
}

describe("island/chorus", () => {
  it("sings loudest at dawn, softer by day, again at dusk, and not at all at night", () => {
    const at = (hour: number) => voicesOf(hour, "clear").birds;
    expect(at(7)).toBe(1);
    expect(at(13)).toBeCloseTo(0.45, 6);
    expect(at(18.5)).toBeCloseTo(0.7, 6);
    expect(at(2)).toBe(0);
    expect(at(22)).toBe(0);
  });

  it("lets the crickets sing from dusk through the night, loudest near midnight, and wraps past it", () => {
    const at = (hour: number) => voicesOf(hour, "clear").crickets;
    expect(at(23)).toBe(1);
    expect(at(1)).toBeGreaterThan(0.4);
    expect(at(21)).toBeGreaterThan(0.3);
    expect(at(12)).toBe(0);
    expect(at(24 + 23)).toBe(1);
  });

  it("quiets every voice while rain, a storm or snow falls, and only dims the birds under a grey sky", () => {
    for (const weather of ["rain", "storm", "snow"] as const) {
      expect(voicesOf(7, weather)).toEqual({ birds: 0, crickets: 0 });
      expect(voicesOf(23, weather)).toEqual({ birds: 0, crickets: 0 });
    }
    expect(voicesOf(7, "clouds").birds).toBeCloseTo(0.6, 6);
    expect(voicesOf(23, "clouds").crickets).toBe(1);
  });

  it("crows at dawn and at no other hour", () => {
    expect(crowsAt(6)).toBe(true);
    expect(crowsAt(5.4)).toBe(false);
    expect(crowsAt(7)).toBe(false);
    expect(crowsAt(18)).toBe(false);
  });

  it("calls with the same recording, pitch and side for the same seed in the same place", () => {
    const meadow = { ...OPEN, meadow: 1 };
    expect(callOf(5, meadow, false)).toEqual(callOf(5, meadow, false));
    for (const shot of calls(meadow, false)) {
      expect(shot.loud).toBeGreaterThan(0.1);
      expect(shot.loud).toBeLessThanOrEqual(0.3);
      expect(shot.rate).toBeGreaterThan(0.93);
      expect(shot.rate).toBeLessThan(1.07);
      expect(Math.abs(shot.pan)).toBeLessThanOrEqual(0.6);
    }
  });

  it("lets each place be called by what lives there: gulls by the sea, ducks by fresh water, hens about the houses", () => {
    const heard = (place: Partial<typeof OPEN>, night = false) =>
      Arr.sort(
        Arr.dedupe(
          Arr.map(calls({ ...OPEN, ...place }, night), (shot) => shot.file)
        ),
        Order.String
      );
    expect(heard({})).toEqual(["bulbul", "kite"]);
    expect(heard({ sea: 1 })).toEqual(["crab", "dolphin", "gull"]);
    expect(heard({ sea: 0.5 })).not.toContain("dolphin");
    expect(heard({ forest: 1 })).toEqual(["bulbul", "deer"]);
    expect(heard({ meadow: 1 })).toEqual(["bulbul", "goat", "kite", "rabbit"]);
    expect(heard({ fresh: 1, meadow: 0.5 })).toContain("buffalo");
    expect(heard({ fresh: 1 })).toEqual(["bulbul", "duck", "egret", "kite"]);
    expect(heard({ roof: 1 })).toEqual(["bulbul", "hen", "kite", "meow"]);
  });

  it("leaves the night to the frogs by the water and a cat about the houses, and to nobody elsewhere", () => {
    expect(callOf(3, OPEN, true)).toEqual(Option.none());
    expect(
      Arr.dedupe(
        Arr.map(calls({ ...OPEN, fresh: 1 }, true), (shot) => shot.file)
      )
    ).toEqual(["frog"]);
    expect(
      Arr.dedupe(
        Arr.map(calls({ ...OPEN, roof: 1 }, true), (shot) => shot.file)
      )
    ).toEqual(["meow"]);
  });
});
