import { assert, beforeEach, describe, it } from "@effect/vitest";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { projectTryoutSignedContent } from "@repo/backend/convex/tryouts/runtime/selectors";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import { TRYOUT_TEST_NOW } from "@repo/backend/test/tryouts";
import { Effect } from "effect";

beforeEach(() => {
  vi.setSystemTime(new Date(TRYOUT_TEST_NOW));
});

describe("tryouts/runtime/selectors", () => {
  it.effect(
    "projects immutable question selectors and only authorized answers",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const seeded = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            seedTryoutContentAccessState(ctx, {
              attemptStatus: "completed",
              sectionStatus: "completed",
              suffix: "signed-selectors",
            })
          )
        );
        for (const answers of [false, true]) {
          const content = yield* Effect.promise(() =>
            t.query(async (ctx) => {
              const attempt = await ctx.db.get(
                "tryoutAttempts",
                seeded.attemptId
              );
              const placement = await ctx.db.get(
                "tryoutAttemptPlacements",
                seeded.placementId
              );
              assert.isNotNull(attempt);
              assert.isNotNull(placement);
              return runConvexProgram(
                projectTryoutSignedContent({
                  answers,
                  appLocale: "id",
                  attempt,
                  ctx,
                  placements: [placement],
                  totalQuestions: 1,
                })
              );
            })
          );
          assert.deepStrictEqual(content, {
            answers: answers ? [seeded.signedContent.answer] : [],
            kind: "signed",
            questions: [seeded.signedContent.question],
          });
        }
      })
  );

  it.effect(
    "rejects incomplete frozen identities and mismatched locale or placement count",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const seeded = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            seedTryoutContentAccessState(ctx, {
              attemptStatus: "completed",
              sectionStatus: "completed",
              suffix: "broken-selectors",
            })
          )
        );
        for (const field of [
          "answerArtifactHash",
          "answerContentKey",
          "questionArtifactHash",
          "questionContentKey",
          "sectionKey",
          "locale",
          "placements",
        ]) {
          const result = yield* Effect.promise(() =>
            t.query(async (ctx) => {
              const attempt = await ctx.db.get(
                "tryoutAttempts",
                seeded.attemptId
              );
              const placement = await ctx.db.get(
                "tryoutAttemptPlacements",
                seeded.placementId
              );
              assert.isNotNull(attempt);
              assert.isNotNull(placement);
              return runConvexProgram(
                projectTryoutSignedContent({
                  answers: true,
                  appLocale: field === "locale" ? "en" : "id",
                  attempt,
                  ctx,
                  placements:
                    field === "placements"
                      ? []
                      : [{ ...placement, [field]: "" }],
                  totalQuestions: 1,
                }).pipe(
                  Effect.match({
                    onFailure: (error) => ({
                      code: error.code,
                      tag: error._tag,
                    }),
                    onSuccess: () => null,
                  })
                )
              );
            })
          );
          assert.deepStrictEqual(result, {
            code: "TRYOUT_SELECTOR_INTEGRITY",
            tag: "TryoutSelectorReadError",
          });
        }
      })
  );
});
