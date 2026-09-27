import {
  DatabaseReader as ConfectDatabaseReader,
  RegisteredConvexFunction,
} from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import {
  readCurrentTryoutCountry,
  readLearningPreferenceByUserId,
  setPreferredCurriculumProgram,
  upsertPreferredTryoutCountry,
} from "@repo/backend/confect/learningPreferences/impl";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { activateTryoutStartSource } from "@repo/backend/test/tryout/source";
import { Effect } from "effect";

describe("learningPreferences/impl", () => {
  it("clears absent curriculum preferences without creating a row", async () => {
    const test = createConvexTestWithBetterAuth();
    await test.mutation(async (ctx) => {
      const { userId } = await seedAuthenticatedUser(ctx, {
        now: 1,
      });
      expect(
        await Effect.runPromise(
          setPreferredCurriculumProgram({
            now: 1,
            programKey: null,
            userId,
          }).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      ).toBeNull();
      expect(
        await Effect.runPromise(
          readLearningPreferenceByUserId(userId).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      ).toBeNull();
    });
  });
  it("preserves independent preferences and timestamps across repeated updates", async () => {
    const test = createConvexTestWithBetterAuth();
    await test.mutation(async (ctx) => {
      const { userId } = await seedAuthenticatedUser(ctx, {
        now: 1,
      });
      const rowId = await Effect.runPromise(
        setPreferredCurriculumProgram({
          now: 1,
          programKey: "first",
          userId,
        }).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      );
      expect(
        await Effect.runPromise(
          setPreferredCurriculumProgram({
            now: 2,
            programKey: "first",
            userId,
          }).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      ).toBe(rowId);
      expect(
        await Effect.runPromise(
          readLearningPreferenceByUserId(userId).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      ).toMatchObject({
        updatedAt: 1,
      });
      await Effect.runPromise(
        upsertPreferredTryoutCountry({
          countryKey: "indonesia",
          now: 3,
          userId,
        }).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      );
      expect(
        await Effect.runPromise(
          upsertPreferredTryoutCountry({
            countryKey: "indonesia",
            now: 4,
            userId,
          }).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      ).toBe(rowId);
      expect(
        await Effect.runPromise(
          readLearningPreferenceByUserId(userId).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      ).toMatchObject({
        preferredCurriculumProgramKey: "first",
        preferredTryoutCountryKey: "indonesia",
        updatedAt: 3,
      });
      await Effect.runPromise(
        upsertPreferredTryoutCountry({
          countryKey: "singapore",
          now: 5,
          userId,
        }).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      );
      await Effect.runPromise(
        setPreferredCurriculumProgram({
          now: 6,
          programKey: "second",
          userId,
        }).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      );
      await Effect.runPromise(
        setPreferredCurriculumProgram({
          now: 7,
          programKey: null,
          userId,
        }).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      );
      await Effect.runPromise(
        setPreferredCurriculumProgram({
          now: 8,
          programKey: null,
          userId,
        }).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      );
      const row = await Effect.runPromise(
        readLearningPreferenceByUserId(userId).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
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
      const user = await seedAuthenticatedUser(ctx, {
        now: 1,
      });
      await activateTryoutStartSource(ctx, "visible");
      return user.userId;
    });
    expect(
      await test.query((_ctx) =>
        Effect.runPromise(
          readCurrentTryoutCountry({
            locale: "id",
            userId,
          }).pipe(
            Effect.provide(ConfectDatabaseReader.layer(confectSchema, _ctx.db))
          )
        )
      )
    ).toBeNull();
    await test.mutation((_ctx) =>
      Effect.runPromise(
        upsertPreferredTryoutCountry({
          countryKey: "retired-country",
          now: 1,
          userId,
        }).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, _ctx)
          )
        )
      )
    );
    expect(
      await test.query((_ctx) =>
        Effect.runPromise(
          readCurrentTryoutCountry({
            locale: "id",
            userId,
          }).pipe(
            Effect.provide(ConfectDatabaseReader.layer(confectSchema, _ctx.db))
          )
        )
      )
    ).toBeNull();
  });
  it.each(["create", "update-country", "update-curriculum"])(
    "redacts a %s failure while preserving preferences",
    async (operation) => {
      const test = createConvexTestWithBetterAuth();
      await test.mutation(async (ctx) => {
        const { userId } = await seedAuthenticatedUser(ctx, {
          now: 1,
        });
        if (operation === "create") {
          vi.spyOn(ctx.db, "insert").mockRejectedValue(
            "private database detail"
          );
        } else {
          await ctx.db.insert("learningPreferences", {
            userId,
            updatedAt: 1,
            preferredTryoutCountryKey: "indonesia",
          });
          vi.spyOn(ctx.db, "replace").mockRejectedValue(
            "private database detail"
          );
        }
        const write =
          operation === "update-curriculum"
            ? setPreferredCurriculumProgram({
                now: 2,
                programKey: "new-program",
                userId,
              })
            : upsertPreferredTryoutCountry({
                countryKey: "singapore",
                now: 2,
                userId,
              });
        const failure = await Effect.runPromise(
          write.pipe(
            Effect.flip,
            Effect.orDie,
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        );
        expect(failure).toMatchObject({
          _tag: "LearningPreferencePersistenceError",
          code: "LEARNING_PREFERENCE_PERSISTENCE_FAILED",
        });
        expect(JSON.stringify(failure)).not.toContain(
          "private database detail"
        );
        const stored = await ctx.db.query("learningPreferences").unique();
        expect(stored?.preferredCurriculumProgramKey).toBeUndefined();
        expect(stored?.preferredTryoutCountryKey).toBe(
          operation === "create" ? undefined : "indonesia"
        );
      });
    }
  );
});
