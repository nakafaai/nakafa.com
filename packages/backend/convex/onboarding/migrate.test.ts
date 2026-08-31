import { describe, expect, it, vi } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 7, 31, 13, 0, 0);
type OnboardingTest = ReturnType<typeof createConvexTestWithBetterAuth>;

interface LegacyPreferenceInput {
  readonly learningInterest?: Doc<"learningPreferences">["learningInterest"];
  readonly preferredCurriculumProgramKey?: string;
  readonly primaryProgramKey?: string;
}

interface LegacyUserInput {
  readonly deleted?: boolean;
  readonly preference?: LegacyPreferenceInput;
  readonly role?: Doc<"users">["role"];
  readonly suffix: string;
}

/** Seeds one legacy user row and its optional old learning selection. */
const seedLegacyUser = Effect.fn("test.onboarding.seedLegacyUser")(function* (
  test: OnboardingTest,
  input: LegacyUserInput
) {
  const identity = yield* Effect.promise(() =>
    test.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        role: input.role,
        suffix: input.suffix,
      })
    )
  );

  if (input.preference) {
    yield* Effect.promise(() =>
      test.mutation((ctx) =>
        ctx.db.insert("learningPreferences", {
          ...input.preference,
          updatedAt: NOW - 1,
          userId: identity.userId,
        })
      )
    );
  }

  if (input.deleted) {
    yield* Effect.promise(() =>
      test.mutation((ctx) =>
        ctx.db.patch("users", identity.userId, { deletedAt: NOW - 1 })
      )
    );
  }

  return identity.userId;
});

/** Reads one user's migrated profile and retained learning preference. */
const readMigratedUser = Effect.fn("test.onboarding.readMigratedUser")(
  function* (test: OnboardingTest, userId: Doc<"users">["_id"]) {
    return yield* Effect.promise(() =>
      test.query(async (ctx) => ({
        preference: await ctx.db
          .query("learningPreferences")
          .withIndex("by_userId", (query) => query.eq("userId", userId))
          .unique(),
        profile: await ctx.db
          .query("onboardingProfiles")
          .withIndex("by_userId", (query) => query.eq("userId", userId))
          .unique(),
      }))
    );
  }
);

describe("onboarding legacy migration", () => {
  it.effect("migrates only complete legacy facts and stays idempotent", () =>
    Effect.gen(function* () {
      vi.setSystemTime(new Date(NOW));
      const test = createConvexTestWithBetterAuth();

      const indonesia = yield* seedLegacyUser(test, {
        preference: {
          learningInterest: "exam-prep",
          primaryProgramKey: "snbt",
        },
        role: "student",
        suffix: "indonesia",
      });
      const international = yield* seedLegacyUser(test, {
        preference: {
          learningInterest: "school-curriculum",
          preferredCurriculumProgramKey: "cambridge-international",
          primaryProgramKey: "cambridge-international",
        },
        role: "teacher",
        suffix: "international",
      });
      const singapore = yield* seedLegacyUser(test, {
        preference: {
          learningInterest: "exam-prep",
          preferredCurriculumProgramKey: "singapore-moe",
          primaryProgramKey: "snbt",
        },
        role: "parent",
        suffix: "singapore",
      });
      const unitedStates = yield* seedLegacyUser(test, {
        preference: { primaryProgramKey: "united-states" },
        role: "student",
        suffix: "united-states",
      });
      const assessment = yield* seedLegacyUser(test, {
        preference: {
          learningInterest: "assessment-prep",
          preferredCurriculumProgramKey: "merdeka",
          primaryProgramKey: "assessment",
        },
        role: "parent",
        suffix: "assessment",
      });
      const tka = yield* seedLegacyUser(test, {
        preference: { primaryProgramKey: "tka" },
        role: "student",
        suffix: "tka",
      });
      const preferredOnly = yield* seedLegacyUser(test, {
        preference: { preferredCurriculumProgramKey: "merdeka" },
        role: "teacher",
        suffix: "preferred-only",
      });
      const existing = yield* seedLegacyUser(test, {
        preference: {
          learningInterest: "school-curriculum",
          primaryProgramKey: "merdeka",
        },
        role: "student",
        suffix: "existing",
      });
      yield* Effect.promise(() =>
        test.mutation((ctx) =>
          ctx.db.insert("onboardingProfiles", {
            focus: "learning",
            region: "indonesia",
            role: "student",
            updatedAt: NOW - 2,
            userId: existing,
          })
        )
      );

      yield* seedLegacyUser(test, {
        preference: {
          learningInterest: "school-curriculum",
          primaryProgramKey: "merdeka",
        },
        role: "administrator",
        suffix: "administrator",
      });
      yield* seedLegacyUser(test, {
        role: "student",
        suffix: "missing-preference",
      });
      yield* seedLegacyUser(test, {
        deleted: true,
        preference: {
          learningInterest: "school-curriculum",
          primaryProgramKey: "merdeka",
        },
        role: "student",
        suffix: "deleted",
      });
      yield* seedLegacyUser(test, {
        preference: { primaryProgramKey: "unknown-program" },
        role: "student",
        suffix: "unknown-program",
      });
      yield* seedLegacyUser(test, {
        preference: {
          learningInterest: "school-curriculum",
          primaryProgramKey: "snbt",
        },
        role: "student",
        suffix: "conflicting-focus",
      });

      const first = yield* Effect.promise(() =>
        test.action(internal.onboarding.migrate.run, { cursor: null })
      );

      expect(first).toEqual({
        alreadyPresent: 1,
        continueCursor: expect.any(String),
        created: 7,
        isDone: true,
        requiresOnboarding: 5,
      });
      expect((yield* readMigratedUser(test, indonesia)).profile).toMatchObject({
        completedAt: NOW,
        focus: "tryout",
        region: "indonesia",
        role: "student",
      });
      expect(
        (yield* readMigratedUser(test, indonesia)).preference
          ?.preferredCurriculumProgramKey
      ).toBeUndefined();
      expect(
        (yield* readMigratedUser(test, international)).profile
      ).toMatchObject({
        focus: "learning",
        region: "international",
        role: "teacher",
      });
      expect((yield* readMigratedUser(test, singapore)).profile).toMatchObject({
        focus: "tryout",
        region: "singapore",
        role: "parent",
      });
      expect(
        (yield* readMigratedUser(test, unitedStates)).profile
      ).toMatchObject({
        focus: "learning",
        region: "united-states",
      });
      expect((yield* readMigratedUser(test, assessment)).profile).toMatchObject(
        {
          focus: "tryout",
          region: "indonesia",
        }
      );
      expect((yield* readMigratedUser(test, tka)).profile).toMatchObject({
        focus: "tryout",
        region: "indonesia",
      });
      expect(
        (yield* readMigratedUser(test, preferredOnly)).profile
      ).toMatchObject({
        focus: "learning",
        region: "indonesia",
      });

      const second = yield* Effect.promise(() =>
        test.action(internal.onboarding.migrate.run, { cursor: null })
      );
      expect(second).toMatchObject({
        alreadyPresent: 8,
        created: 0,
        isDone: true,
        requiresOnboarding: 5,
      });
    })
  );
});
