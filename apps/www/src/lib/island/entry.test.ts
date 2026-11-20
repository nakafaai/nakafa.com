// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { EMPTY_TALLY } from "@repo/backend/confect/island/schema";
import { entryOf } from "@/lib/island/entry";
import { seedOf } from "@/lib/island/noise";

describe("island/entry", () => {
  it("opens a learner's island at the level their lifetime Stars reached, with their edits and tally", () => {
    const tally = { ...EMPTY_TALLY, days: 4, lessons: 9 };
    expect(
      entryOf(
        {
          lifetime: 420,
          tally,
          version: 3,
          world: [{ block: 5, x: 30, y: 9, z: 30 }],
        },
        "users-1"
      )
    ).toEqual({
      edits: [{ block: 5, x: 30, y: 9, z: 30 }],
      from: 250,
      level: 3,
      lifetime: 420,
      next: 450,
      seed: seedOf("users-1"),
      size: 56,
      tally,
      version: 3,
    });
  });

  it("opens how far a learner grew with no edits, as a try-out pane reads it", () => {
    const tally = { ...EMPTY_TALLY, sets: 2 };
    expect(entryOf({ lifetime: 120, tally }, undefined)).toMatchObject({
      edits: [],
      level: 2,
      tally,
      version: 0,
    });
  });

  it("starts a learner with no island at level 1 with nothing counted", () => {
    expect(entryOf(null, undefined)).toEqual({
      edits: [],
      from: 0,
      level: 1,
      lifetime: 0,
      next: 100,
      seed: seedOf("island"),
      size: 52,
      tally: EMPTY_TALLY,
      version: 0,
    });
  });
});
