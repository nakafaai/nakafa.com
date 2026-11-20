// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import type { Heard } from "@/lib/island/cues";
import { Cue, cuesOf, shotsOf } from "@/lib/island/cues";

/** A quiet moment of a game. */
const QUIET: Heard = {
  blueprints: 5,
  catches: 0,
  deed: "cast",
  deeds: 0,
  last: "none",
  mode: "explore",
  notice: null,
  past: 2,
  pending: 0,
  sheet: null,
  turn: 0,
};

describe("island/cues", () => {
  it("hears nothing when nothing the learner did changed", () => {
    expect(cuesOf(QUIET, QUIET)).toEqual([]);
    // The server took what waited: fewer operations wait, and nothing was done.
    expect(cuesOf({ ...QUIET, last: "set", pending: 2 }, QUIET)).toEqual([]);
  });

  it("hears a thing set down, a thing taken and a stroke of a brush by the latest operation", () => {
    const did = (last: Heard["last"]) =>
      cuesOf(QUIET, { ...QUIET, last, past: 3, pending: 1 });
    expect(did("set")).toEqual(["place"]);
    expect(did("take")).toEqual(["take"]);
    expect(did("land")).toEqual(["brush"]);
  });

  it("hears an undo as an undo and not as the change that takes the step back", () => {
    expect(
      cuesOf(QUIET, { ...QUIET, last: "take", past: 1, pending: 1 })
    ).toEqual(["undo"]);
  });

  it("hears a turn of the hand, a catch, a bite, an escape and a press that did not take", () => {
    expect(cuesOf(QUIET, { ...QUIET, turn: 1 })).toEqual(["turn"]);
    expect(cuesOf(QUIET, { ...QUIET, catches: 1 })).toEqual(["catch"]);
    expect(cuesOf(QUIET, { ...QUIET, notice: "bite" })).toEqual(["bite"]);
    expect(cuesOf(QUIET, { ...QUIET, notice: "escaped" })).toEqual(["escaped"]);
    expect(cuesOf(QUIET, { ...QUIET, notice: "steep" })).toEqual(["notice"]);
    expect(cuesOf({ ...QUIET, notice: "steep" }, QUIET)).toEqual([]);
  });

  it("hears a blueprint opened with Stars, the hands changed and a sheet opened, together when they come together", () => {
    expect(
      cuesOf(QUIET, { ...QUIET, blueprints: 6, mode: "build", sheet: "map" })
    ).toEqual(["stars", "mode", "sheet"]);
    // A sheet that closes is not heard.
    expect(cuesOf({ ...QUIET, sheet: "map" }, QUIET)).toEqual([]);
  });

  it("hears each deed of the fox as its own: a cast, a stroke, a shaken tree", () => {
    for (const deed of ["cast", "pet", "shake"] as const) {
      expect(cuesOf(QUIET, { ...QUIET, deed, deeds: 1 })).toEqual([deed]);
    }
    expect(cuesOf(QUIET, { ...QUIET, deed: "pet" })).toEqual([]);
  });

  it("plays every cue from recordings, never louder than the recording itself", () => {
    for (const cue of Cue.literals) {
      const shots = shotsOf(cue, 0);
      expect(shots.length).toBeGreaterThan(0);
      for (const shot of shots) {
        expect(shot.loud).toBeGreaterThan(0);
        expect(shot.loud).toBeLessThanOrEqual(1);
        expect(shot.rate).toBeGreaterThan(0.2);
        expect(shot.delay).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("climbs the scale as things are set down in a row, and ends an opened blueprint on the wind chimes", () => {
    const note = (run: number) => shotsOf("place", run)[1].rate;
    expect(note(1)).toBeGreaterThan(note(0));
    expect(note(2)).toBeGreaterThan(note(1));
    expect(note(8)).toBe(note(0));
    expect(shotsOf("place", 0)[0].file).toBe("thud");
    expect(Arr.map(shotsOf("stars", 0), (shot) => shot.file)).toEqual([
      "spark",
      ...Arr.makeBy(4, () => "note"),
      "koshi",
    ]);
    expect(shotsOf("brush", 1)[0].rate).not.toBe(shotsOf("brush", 2)[0].rate);
  });
});
