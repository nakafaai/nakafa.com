import { DatabaseReader as ConfectDatabaseReader } from "@confect/server";
import { assert, beforeEach, describe, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { projectTryoutSignedContent } from "@repo/backend/confect/tryouts/runtime/selectors";
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
        const runtimeServices = yield* Effect.context<never>();
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
        for (const [answers, preview] of [
          [false, false],
          [true, false],
          [false, true],
        ] as const) {
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
              return Effect.runPromiseWith(runtimeServices)(
                projectTryoutSignedContent({
                  answers,
                  appLocale: "id",
                  attempt,
                  placements: [placement],
                  preview,
                  totalQuestions: 1,
                }).pipe(
                  Effect.provide(
                    ConfectDatabaseReader.layer(confectSchema, ctx.db)
                  )
                )
              );
            })
          );
          assert.deepStrictEqual(content, {
            answers: answers ? [seeded.signedContent.answer] : [],
            kind: "signed",
            previewAnswers: preview ? [seeded.signedContent.answer] : [],
            questions: [seeded.signedContent.question],
          });
        }
      })
  );
  it.effect(
    "previews only the answers of the section's leading questions",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = createConvexTestWithBetterAuth();
        const seeded = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            seedTryoutContentAccessState(ctx, {
              attemptStatus: "completed",
              sectionStatus: "completed",
              suffix: "preview-selectors",
            })
          )
        );
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
            return Effect.runPromiseWith(runtimeServices)(
              projectTryoutSignedContent({
                answers: false,
                appLocale: "id",
                attempt,
                placements: [3, 1, 2].map((questionOrder) => ({
                  ...placement,
                  questionOrder,
                })),
                preview: true,
                totalQuestions: 3,
              }).pipe(
                Effect.provide(
                  ConfectDatabaseReader.layer(confectSchema, ctx.db)
                )
              )
            );
          })
        );
        assert.deepStrictEqual(
          content.kind === "signed"
            ? content.previewAnswers.map((answer) => answer.questionOrder)
            : [],
          [1, 2]
        );
        assert.deepStrictEqual(
          content.kind === "signed" ? content.answers : null,
          []
        );
      })
  );
  it.effect(
    "rejects incomplete frozen identities and mismatched placement count",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
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
              return Effect.runPromiseWith(runtimeServices)(
                projectTryoutSignedContent({
                  answers: true,
                  appLocale: "id",
                  attempt,
                  placements:
                    field === "placements"
                      ? []
                      : [
                          {
                            ...placement,
                            [field]: "",
                          },
                        ],
                  preview: false,
                  totalQuestions: 1,
                }).pipe(
                  Effect.match({
                    onFailure: (error) => ({
                      code: error.code,
                      tag: error._tag,
                    }),
                    onSuccess: () => null,
                  }),
                  Effect.provide(
                    ConfectDatabaseReader.layer(confectSchema, ctx.db)
                  )
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
