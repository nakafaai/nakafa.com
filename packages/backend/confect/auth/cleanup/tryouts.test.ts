import { describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import { tryoutWorld } from "@repo/backend/test/tryout/world";
import { Effect } from "effect";

describe("auth/cleanup/tryouts", () => {
  it.effect(
    "deletes a learner's progress, attempts and everything they own, and keeps the shared scale",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld({ scoring: { kind: "irt" } });
        const { attemptId } = yield* world.start();
        yield* world.startSection(attemptId, "section-a");
        yield* world.answer(attemptId, {
          order: 1,
          pick: "correct",
          section: "section-a",
        });
        yield* world.completeSection(attemptId, "section-a");
        yield* world.startSection(attemptId, "section-b");
        yield* world.completeSection(attemptId, "section-b");
        let progressed = true;
        for (let page = 0; page < 16 && progressed; page += 1) {
          progressed = yield* Effect.promise(() =>
            world.t.mutation(internal.auth.cleanup.cleanupDeletedUser, {
              userId: world.userId,
            })
          );
        }
        expect(progressed).toBe(false);
        const state = yield* Effect.promise(() =>
          world.t.query(async (ctx) => ({
            attempts: await ctx.db.query("tryoutAttempts").collect(),
            placements: await ctx.db.query("tryoutAttemptPlacements").collect(),
            progress: await ctx.db.query("tryoutSetProgress").collect(),
            responses: await ctx.db.query("tryoutResponses").collect(),
            scales: await ctx.db.query("irtScaleVersions").collect(),
            scores: await ctx.db.query("tryoutScores").collect(),
            sections: await ctx.db.query("tryoutSectionAttempts").collect(),
          }))
        );
        expect(state).toMatchObject({
          attempts: [],
          placements: [],
          progress: [],
          responses: [],
          scales: [{ setIdentity: "indonesia/snbt/2027/set-1" }],
          scores: [],
          sections: [],
        });
      })
  );
});
