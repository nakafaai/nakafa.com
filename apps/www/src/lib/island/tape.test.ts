// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  addressOf,
  bendOf,
  noteOf,
  Recording,
  shotOf,
} from "@/lib/island/tape";

describe("island/tape", () => {
  it("names fifty recordings, each once, and reads each from the world's own folder", () => {
    expect(Recording.literals.length).toBe(46);
    expect(Arr.dedupe(Recording.literals).length).toBe(46);
    expect(addressOf("step-grass")).toBe("/island/audio/step-grass.m4a");
  });

  it("plays a recording as it was recorded unless told otherwise", () => {
    expect(shotOf("thud", 0.9)).toEqual({
      cut: 0,
      delay: 0,
      file: "thud",
      loud: 0.9,
      pan: 0,
      rate: 1,
    });
    expect(shotOf("splash", 0.1, { cut: 0.3, rate: 1.7 })).toMatchObject({
      cut: 0.3,
      delay: 0,
      rate: 1.7,
    });
  });

  it("tunes a sampled bar to the scale: an octave up doubles its speed, and five degrees are an octave", () => {
    const low = noteOf("note", 0, 1, 0, 0.3);
    expect(low.rate).toBeCloseTo((261.63 * 2) / 783.3, 6);
    expect(noteOf("note", 5, 1, 0, 0.3).rate).toBeCloseTo(low.rate * 2, 6);
    expect(noteOf("note", -5, 1, 0, 0.3).rate).toBeCloseTo(low.rate / 2, 6);
    expect(noteOf("note", 3, 1, 0, 0.3).rate).toBeCloseTo(
      low.rate * 2 ** (7 / 12),
      6
    );
    expect(noteOf("chime", 2, 2, 0.16, 0.3)).toMatchObject({
      delay: 0.16,
      file: "chime",
      loud: 0.3,
    });
  });

  it("bends a sound a little each time, the same way for the same play, never past its range", () => {
    const bends = Arr.makeBy(200, (count) => bendOf(83, count, 220));
    expect(bendOf(83, 7, 220)).toBe(bends[7]);
    expect(Math.max(...bends)).toBeLessThanOrEqual(2 ** (220 / 1200));
    expect(Math.min(...bends)).toBeGreaterThanOrEqual(2 ** (-220 / 1200));
    expect(Arr.dedupe(bends).length).toBeGreaterThan(150);
  });
});
