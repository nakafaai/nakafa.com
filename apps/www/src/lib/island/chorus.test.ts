// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Order } from "effect";
import { callOf, voicesOf } from "@/lib/island/chorus";

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

  it("gives each bird one call of three songs, the same every time, in a bird's own range", () => {
    expect(callOf(5)).toEqual(callOf(5));
    const shapes = Arr.dedupe(
      Arr.map(
        Arr.makeBy(60, (seed) => callOf(seed)),
        (call) => {
          if (call.length > 2) {
            return "trill";
          }
          return call[1].from > call[0].from ? "question" : "whistle";
        }
      )
    );
    expect(Arr.sort(shapes, Order.String)).toEqual([
      "question",
      "trill",
      "whistle",
    ]);
    for (const note of Arr.flatten(Arr.makeBy(60, (seed) => callOf(seed)))) {
      expect(note.from).toBeGreaterThan(1500);
      expect(note.to).toBeLessThan(5500);
      expect(note.length).toBeGreaterThan(0);
    }
  });
});
