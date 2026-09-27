import { DatabaseReader } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { readAttemptAnswer } from "@repo/backend/confect/tryouts/runtime/answer";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import { Effect } from "effect";

describe("retained explanation language", () => {
  it("reads a signed sibling without changing the original exam content", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation((ctx) =>
      seedTryoutContentAccessState(ctx, {
        attemptStatus: "completed",
        sectionStatus: "completed",
        suffix: "answer-language",
      })
    );
    await t.query(async (ctx) => {
      const attempt = await ctx.db.get(seeded.attemptId);
      const placement = await ctx.db.get(seeded.placementId);
      assert.isNotNull(attempt);
      assert.isNotNull(placement);
      for (const locale of ["id", "en"] as const) {
        const answer = await Effect.runPromise(
          readAttemptAnswer(attempt, placement, locale).pipe(
            Effect.provide(DatabaseReader.layer(confectSchema, ctx.db))
          )
        );
        expect(answer).toMatchObject({
          artifactLocale: locale,
          contentKey: placement.answerContentKey,
        });
      }
      expect(await ctx.db.get(seeded.placementId)).toEqual(placement);
      await expect(
        Effect.runPromise(
          readAttemptAnswer(attempt, placement, "de").pipe(
            Effect.provide(DatabaseReader.layer(confectSchema, ctx.db))
          )
        )
      ).rejects.toMatchObject({
        code: "TRYOUT_SELECTOR_INTEGRITY",
        message: "The exam snapshot has no explanation in this language.",
      });
      for (const field of [
        "sourcePath",
        "sourceRevision",
        "questionContentKey",
        "answerContentKey",
      ] as const) {
        await expect(
          Effect.runPromise(
            readAttemptAnswer(
              attempt,
              { ...placement, [field]: "different-source" },
              "en"
            ).pipe(Effect.provide(DatabaseReader.layer(confectSchema, ctx.db)))
          )
        ).rejects.toMatchObject({
          code: "TRYOUT_SELECTOR_INTEGRITY",
          message:
            "The localized explanation belongs to a different exam question.",
        });
      }
    });
    await t.mutation(async (ctx) => {
      const rows = await ctx.db.query("tryoutPlacements").collect();
      const english = rows.find((row) => row.appLocale === "en");
      assert.isDefined(english);
      await ctx.db.patch(english._id, { rowHash: "tampered" });
    });
    await t.query(async (ctx) => {
      const attempt = await ctx.db.get(seeded.attemptId);
      const placement = await ctx.db.get(seeded.placementId);
      assert.isNotNull(attempt);
      assert.isNotNull(placement);
      await expect(
        Effect.runPromise(
          readAttemptAnswer(attempt, placement, "en").pipe(
            Effect.provide(DatabaseReader.layer(confectSchema, ctx.db))
          )
        )
      ).rejects.toMatchObject({
        code: "TRYOUT_SELECTOR_INTEGRITY",
        message: "The localized explanation lost its signed snapshot identity.",
      });
    });
  });
});
