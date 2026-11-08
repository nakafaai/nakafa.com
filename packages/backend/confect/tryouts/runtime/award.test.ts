import { describe, expect, it } from "@effect/vitest";
import { tryoutWorld } from "@repo/backend/test/tryout/world";
import { Array as Arr, Effect } from "effect";

/** The island ledger and lifetime of the world's learner. */
const readIsland = (world: Effect.Success<ReturnType<typeof tryoutWorld>>) =>
  Effect.promise(() =>
    world.t.query(async (ctx) => ({
      grants: await ctx.db.query("islandAwards").collect(),
      islands: await ctx.db.query("islands").collect(),
    }))
  );

describe("tryouts/runtime/award", () => {
  it.effect(
    "grants a section closed with an answer, then the set its last section closes, once",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const first = yield* world.start();
        yield* world.startSection(first.attemptId, "section-a");
        yield* world.answer(first.attemptId, {
          order: 1,
          pick: "correct",
          section: "section-a",
        });
        yield* world.completeSection(first.attemptId, "section-a");
        // A section closed without an answer grants nothing of its own.
        yield* world.startSection(first.attemptId, "section-b");
        yield* world.completeSection(first.attemptId, "section-b");
        const once = yield* readIsland(world);
        expect(
          Arr.map(once.grants, (grant) => [grant.kind, grant.key])
        ).toEqual([
          ["section", "section:indonesia/snbt/2027/set-1:section-a"],
          ["set", "set:indonesia/snbt/2027/set-1"],
        ]);
        expect(once.islands[0]?.lifetime).toBe(55);

        // A second attempt of the same set holds the same keys.
        const second = yield* world.start();
        yield* world.startSection(second.attemptId, "section-a");
        yield* world.answer(second.attemptId, {
          order: 1,
          pick: "correct",
          section: "section-a",
        });
        yield* world.completeSection(second.attemptId, "section-a");
        yield* world.startSection(second.attemptId, "section-b");
        yield* world.completeSection(second.attemptId, "section-b");
        expect((yield* readIsland(world)).grants).toHaveLength(2);
      })
  );

  it.effect("grants no set whose sections were all closed empty", () =>
    Effect.gen(function* () {
      const world = yield* tryoutWorld();
      const { attemptId } = yield* world.start();
      for (const section of ["section-a", "section-b"]) {
        yield* world.startSection(attemptId, section);
        yield* world.completeSection(attemptId, section);
      }
      expect(yield* readIsland(world)).toEqual({ grants: [], islands: [] });
    })
  );
});
