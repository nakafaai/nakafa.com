import { DatabaseReader as ConfectDatabaseReader } from "@confect/server";
import { assert, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { loadSectionState } from "@repo/backend/confect/tryouts/runtime/section/questions";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import { Effect } from "effect";

it.effect(
  "keeps completed sections hidden until the whole attempt is terminal",
  () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
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
          return Effect.runPromiseWith(runtimeServices)(
            loadSectionState(attempt, section).pipe(
              Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
            )
          );
        })
      );
      assert.deepStrictEqual(state, {
        content: {
          kind: "none",
        },
        runtime: null,
      });
    })
);
