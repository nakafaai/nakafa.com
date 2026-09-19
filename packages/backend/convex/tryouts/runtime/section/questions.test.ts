import { assert, it } from "@effect/vitest";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { loadSectionState } from "@repo/backend/convex/tryouts/runtime/section/questions";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import { Effect } from "effect";

it.effect(
  "keeps completed sections hidden until the whole attempt is terminal",
  () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          seedTryoutContentAccessState(ctx, {
            attemptStatus: "in-progress",
            sectionStatus: "completed",
            suffix: "unfinished-attempt-review",
          })
        )
      );
      const state = yield* Effect.promise(() =>
        t.query(async (ctx) => {
          const attempt = await ctx.db.get("tryoutAttempts", seeded.attemptId);
          const section = await ctx.db.get(
            "tryoutSectionAttempts",
            seeded.sectionAttemptId
          );
          assert.isNotNull(attempt);
          assert.isNotNull(section);
          return runConvexProgram(loadSectionState(ctx, attempt, section));
        })
      );
      assert.deepStrictEqual(state, {
        content: { kind: "none" },
        runtime: null,
      });
    })
);
