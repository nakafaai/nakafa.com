import { describe, expect, it } from "@effect/vitest";
import {
  readCurrentTryoutCountry,
  readLearningPreferenceByUserId,
  setPreferredCurriculumProgram,
  upsertPreferredTryoutCountry,
} from "@repo/backend/convex/learningPreferences/impl";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { activateTryoutStartSource } from "@repo/backend/test/tryout/source";
import { Effect } from "effect";

describe("learningPreferences/impl", () => {
  it("clears absent curriculum preferences without creating a row", async () => {
    const test = createConvexTestWithBetterAuth();
    await test.mutation(async (ctx) => {
      const { userId } = await seedAuthenticatedUser(ctx, { now: 1 });
      expect(
        await runConvexProgram(
          setPreferredCurriculumProgram({
            ctx,
            now: 1,
            programKey: null,
            userId,
          })
        )
      ).toBeNull();
      expect(
        await runConvexProgram(readLearningPreferenceByUserId(ctx, userId))
      ).toBeNull();
    });
  });

  it("preserves independent preferences and timestamps across repeated updates", async () => {
    const test = createConvexTestWithBetterAuth();
    await test.mutation(async (ctx) => {
      const { userId } = await seedAuthenticatedUser(ctx, { now: 1 });
      const rowId = await runConvexProgram(
        setPreferredCurriculumProgram({
          ctx,
          now: 1,
          programKey: "first",
          userId,
        })
      );
      expect(
        await runConvexProgram(
          setPreferredCurriculumProgram({
            ctx,
            now: 2,
            programKey: "first",
            userId,
          })
        )
      ).toBe(rowId);
      expect(
        await runConvexProgram(readLearningPreferenceByUserId(ctx, userId))
      ).toMatchObject({ updatedAt: 1 });
      await runConvexProgram(
        upsertPreferredTryoutCountry({
          countryKey: "indonesia",
          ctx,
          now: 3,
          userId,
        })
      );
      expect(
        await runConvexProgram(
          upsertPreferredTryoutCountry({
            countryKey: "indonesia",
            ctx,
            now: 4,
            userId,
          })
        )
      ).toBe(rowId);
      expect(
        await runConvexProgram(readLearningPreferenceByUserId(ctx, userId))
      ).toMatchObject({
        preferredCurriculumProgramKey: "first",
        preferredTryoutCountryKey: "indonesia",
        updatedAt: 3,
      });
      await runConvexProgram(
        upsertPreferredTryoutCountry({
          countryKey: "singapore",
          ctx,
          now: 5,
          userId,
        })
      );
      await runConvexProgram(
        setPreferredCurriculumProgram({
          ctx,
          now: 6,
          programKey: "second",
          userId,
        })
      );
      await runConvexProgram(
        setPreferredCurriculumProgram({ ctx, now: 7, programKey: null, userId })
      );
      await runConvexProgram(
        setPreferredCurriculumProgram({ ctx, now: 8, programKey: null, userId })
      );
      const row = await runConvexProgram(
        readLearningPreferenceByUserId(ctx, userId)
      );
      expect(row).toMatchObject({
        _id: rowId,
        preferredTryoutCountryKey: "singapore",
        updatedAt: 7,
      });
      expect(row?.preferredCurriculumProgramKey).toBeUndefined();
    });
  });

  it("returns no current country for absent and retired saved preferences", async () => {
    const test = createConvexTestWithBetterAuth();
    const userId = await test.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, { now: 1 });
      await activateTryoutStartSource(ctx, "visible");
      return user.userId;
    });
    expect(
      await test.query((ctx) =>
        runConvexProgram(
          readCurrentTryoutCountry(ctx, { locale: "id", userId })
        )
      )
    ).toBeNull();
    await test.mutation((ctx) =>
      runConvexProgram(
        upsertPreferredTryoutCountry({
          countryKey: "retired-country",
          ctx,
          now: 1,
          userId,
        })
      )
    );
    expect(
      await test.query((ctx) =>
        runConvexProgram(
          readCurrentTryoutCountry(ctx, { locale: "id", userId })
        )
      )
    ).toBeNull();
  });

  it("tags persistence failures without exposing the database error", async () => {
    const test = createConvexTestWithBetterAuth();
    await test.mutation(async (ctx) => {
      const { userId } = await seedAuthenticatedUser(ctx, { now: 1 });
      vi.spyOn(ctx.db, "insert").mockRejectedValue("private database detail");
      const failure = await runConvexProgram(
        upsertPreferredTryoutCountry({
          countryKey: "indonesia",
          ctx,
          now: 1,
          userId,
        }).pipe(Effect.flip, Effect.orDie)
      );
      expect(failure).toMatchObject({
        _tag: "LearningPreferencePersistenceError",
        code: "LEARNING_PREFERENCE_PERSISTENCE_FAILED",
      });
      expect(JSON.stringify(failure)).not.toContain("private database detail");
    });
  });
});
