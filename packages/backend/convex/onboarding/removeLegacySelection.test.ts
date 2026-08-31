import { describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 7, 31, 15, 0, 0);

describe("onboarding legacy selection cleanup", () => {
  it.effect("removes only retired fields and stays idempotent", () =>
    Effect.gen(function* () {
      const test = createConvexTestWithBetterAuth();
      const legacy = yield* Effect.promise(() =>
        test.mutation((ctx) =>
          seedAuthenticatedUser(ctx, {
            now: NOW,
            role: "student",
            suffix: "legacy-selection",
          })
        )
      );
      const current = yield* Effect.promise(() =>
        test.mutation((ctx) =>
          seedAuthenticatedUser(ctx, {
            now: NOW,
            role: "teacher",
            suffix: "current-preference",
          })
        )
      );

      yield* Effect.promise(() =>
        test.mutation(async (ctx) => {
          await ctx.db.insert("learningPreferences", {
            learningInterest: "school-curriculum",
            preferredCurriculumProgramKey: "merdeka",
            primaryProgramKey: "merdeka",
            selectionUpdatedAt: NOW - 3,
            updatedAt: NOW - 2,
            userId: legacy.userId,
          });
          await ctx.db.insert("learningPreferences", {
            preferredCurriculumProgramKey: "cambridge-international",
            updatedAt: NOW - 1,
            userId: current.userId,
          });
        })
      );

      const first = yield* Effect.promise(() =>
        test.action(internal.onboarding.removeLegacySelection.run, {
          cursor: null,
        })
      );
      expect(first).toEqual({
        alreadyClean: 1,
        cleaned: 1,
        continueCursor: expect.any(String),
        isDone: true,
      });

      const preferences = yield* Effect.promise(() =>
        test.query((ctx) => ctx.db.query("learningPreferences").collect())
      );
      const cleanedPreference = preferences.find(
        (preference) => preference.userId === legacy.userId
      );
      expect(cleanedPreference).toMatchObject({
        preferredCurriculumProgramKey: "merdeka",
        updatedAt: NOW - 2,
      });
      expect(cleanedPreference).not.toHaveProperty("learningInterest");
      expect(cleanedPreference).not.toHaveProperty("primaryProgramKey");
      expect(cleanedPreference).not.toHaveProperty("selectionUpdatedAt");
      expect(preferences).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            preferredCurriculumProgramKey: "cambridge-international",
            updatedAt: NOW - 1,
            userId: current.userId,
          }),
        ])
      );

      const second = yield* Effect.promise(() =>
        test.action(internal.onboarding.removeLegacySelection.run, {
          cursor: null,
        })
      );
      expect(second).toMatchObject({
        alreadyClean: 2,
        cleaned: 0,
        isDone: true,
      });
    })
  );
});
