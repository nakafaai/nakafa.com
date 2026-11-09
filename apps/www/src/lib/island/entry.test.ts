// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { entryOf } from "@/lib/island/entry";
import { seedOf } from "@/lib/island/noise";

describe("island/entry", () => {
  it("opens a learner's island at the level their lifetime Stars reached, with their edits", () => {
    expect(
      entryOf(
        {
          badges: [{ at: 1, badge: "streak" }],
          lifetime: 420,
          shared: true,
          version: 3,
          world: [{ block: 5, x: 30, y: 9, z: 30 }],
        },
        "users-1"
      )
    ).toEqual({
      badges: ["streak"],
      edits: [{ block: 5, x: 30, y: 9, z: 30 }],
      from: 400,
      level: 3,
      lifetime: 420,
      next: 900,
      seed: seedOf("users-1"),
      shared: true,
      size: 56,
      version: 3,
    });
  });

  it("starts a learner with no island at level 1, and past the last level names no next one", () => {
    expect(entryOf(null, undefined)).toMatchObject({
      badges: [],
      edits: [],
      level: 1,
      next: 150,
      seed: seedOf("island"),
      shared: false,
      size: 52,
      version: 0,
    });
    expect(
      entryOf(
        { badges: [], lifetime: 9000, shared: false, version: 0, world: [] },
        "users-2"
      ).next
    ).toBeUndefined();
  });
});
