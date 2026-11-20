// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { EMPTY_TALLY } from "@repo/backend/confect/island/schema";
import { entryOf } from "@/lib/island/entry";

describe("island/entry", () => {
  it("opens a learner's world at the level their lifetime Stars reached, with their blueprints and tally", () => {
    const tally = { ...EMPTY_TALLY, days: 4, lessons: 9 };
    expect(
      entryOf(
        {
          access: "link",
          balance: 380,
          blueprints: ["cottage"],
          lifetime: 420,
          tally,
        },
        "users-1"
      )
    ).toEqual({
      balance: 380,
      blueprints: ["cottage"],
      from: 250,
      level: 3,
      lifetime: 420,
      next: 450,
      owner: "users-1",
      tally,
    });
  });

  it("opens how far a learner grew with nothing opened, as a try-out pane reads it", () => {
    const tally = { ...EMPTY_TALLY, sets: 2 };
    expect(entryOf({ lifetime: 120, tally }, undefined)).toMatchObject({
      balance: 0,
      blueprints: [],
      level: 2,
      tally,
    });
  });

  it("starts a learner with no island yet at level 1, on the shared seed until their account is read", () => {
    expect(entryOf(undefined, undefined)).toEqual({
      balance: 0,
      blueprints: [],
      from: 0,
      level: 1,
      lifetime: 0,
      next: 100,
      owner: "island",
      tally: EMPTY_TALLY,
    });
  });
});
