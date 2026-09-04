import { describe, expect, it } from "@effect/vitest";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  admitOnboarding,
  finishOnboarding,
  saveOnboardingAnswer,
} from "@repo/backend/convex/onboarding/impl";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { activateOnboardingPrograms } from "@repo/backend/test/onboarding";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
  makeTechnicalProgram,
} from "@repo/backend/test/program/snapshot";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 7, 31, 12, 0, 0);

const createImplTest = Effect.fn("test.onboarding.impl.create")(function* () {
  yield* Effect.sync(() => vi.setSystemTime(NOW));
  const test = createConvexTestWithBetterAuth();
  const identity = yield* Effect.promise(() =>
    test.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "onboarding-impl",
      })
    )
  );
  return { identity, test };
});

describe("onboarding/impl", () => {
  it.effect.each([
    {
      answer: { kind: "role", value: "teacher" } as const,
      expected: { role: "teacher", updatedAt: NOW },
    },
    {
      answer: { kind: "region", value: "germany" } as const,
      expected: { region: "germany", updatedAt: NOW },
    },
    {
      answer: { kind: "focus", value: "tryout" } as const,
      expected: { focus: "tryout", updatedAt: NOW },
    },
  ])("accepts $answer.kind as the first draft answer", ({ answer, expected }) =>
    Effect.gen(function* () {
      const { identity, test } = yield* createImplTest();

      const saved = yield* Effect.promise(() =>
        test.mutation((ctx) =>
          runConvexProgram(saveOnboardingAnswer(ctx, identity.userId, answer))
        )
      );
      const stored = yield* Effect.promise(() =>
        test.query(async (ctx) => ({
          preference: await ctx.db.query("learningPreferences").unique(),
          profile: await ctx.db.query("onboardingProfiles").unique(),
          user: await ctx.db.get("users", identity.userId),
        }))
      );

      expect(saved).toEqual(expected);
      expect(stored.profile).toMatchObject({
        admittedAt: NOW,
        startedAt: NOW,
        ...expected,
      });
      expect(stored.preference).toBeNull();
      expect(stored.user?.role).toBeUndefined();
    })
  );

  it.effect("updates every answer and starts an existing draft", () =>
    Effect.gen(function* () {
      const { identity, test } = yield* createImplTest();
      yield* Effect.promise(() =>
        test.mutation((ctx) =>
          ctx.db.insert("onboardingProfiles", {
            updatedAt: NOW - 1000,
            userId: identity.userId,
          })
        )
      );

      yield* Effect.promise(() =>
        test.mutation((ctx) =>
          runConvexProgram(
            saveOnboardingAnswer(ctx, identity.userId, {
              kind: "role",
              value: "parent",
            })
          )
        )
      );
      yield* Effect.sync(() => vi.setSystemTime(NOW + 1000));
      yield* Effect.promise(() =>
        test.mutation((ctx) =>
          runConvexProgram(
            saveOnboardingAnswer(ctx, identity.userId, {
              kind: "region",
              value: "singapore",
            })
          )
        )
      );
      yield* Effect.sync(() => vi.setSystemTime(NOW + 2000));
      const saved = yield* Effect.promise(() =>
        test.mutation((ctx) =>
          runConvexProgram(
            saveOnboardingAnswer(ctx, identity.userId, {
              kind: "focus",
              value: "learning",
            })
          )
        )
      );
      const stored = yield* Effect.promise(() =>
        test.query((ctx) => ctx.db.query("onboardingProfiles").unique())
      );

      expect(saved).toEqual({
        focus: "learning",
        region: "singapore",
        role: "parent",
        updatedAt: NOW + 2000,
      });
      expect(stored).toMatchObject({
        admittedAt: NOW,
        startedAt: NOW,
        updatedAt: NOW + 2000,
      });
    })
  );

  it.effect("records admission on an existing incomplete profile", () =>
    Effect.gen(function* () {
      const { identity, test } = yield* createImplTest();
      yield* Effect.promise(() =>
        test.mutation((ctx) =>
          ctx.db.insert("onboardingProfiles", {
            focus: "learning",
            updatedAt: NOW - 1000,
            userId: identity.userId,
          })
        )
      );

      const status = yield* Effect.promise(() =>
        test.mutation((ctx) =>
          runConvexProgram(
            admitOnboarding(ctx, { _id: identity.userId, role: undefined })
          )
        )
      );
      const stored = yield* Effect.promise(() =>
        test.query((ctx) => ctx.db.query("onboardingProfiles").unique())
      );

      expect(status).toEqual({
        isAuthenticated: true,
        isRequired: true,
        profile: { focus: "learning", updatedAt: NOW - 1000 },
      });
      expect(stored?.admittedAt).toBe(NOW);
    })
  );

  it.effect("rejects a draft write after completion", () =>
    Effect.gen(function* () {
      const { identity, test } = yield* createImplTest();
      yield* Effect.promise(() =>
        test.mutation((ctx) =>
          ctx.db.insert("onboardingProfiles", {
            completedAt: NOW,
            updatedAt: NOW,
            userId: identity.userId,
          })
        )
      );

      yield* Effect.promise(() =>
        expect(
          test.mutation((ctx) =>
            runConvexProgram(
              saveOnboardingAnswer(ctx, identity.userId, {
                kind: "focus",
                value: "tryout",
              })
            )
          )
        ).rejects.toMatchObject({
          data: {
            code: "ONBOARDING_ALREADY_COMPLETE",
            message: "Onboarding is already complete.",
          },
        })
      );
    })
  );

  it.effect("redacts a duplicate profile invariant failure", () =>
    Effect.gen(function* () {
      const { identity, test } = yield* createImplTest();
      yield* Effect.promise(() =>
        test.mutation(async (ctx) => {
          for (const updatedAt of [NOW - 2000, NOW - 1000]) {
            await ctx.db.insert("onboardingProfiles", {
              updatedAt,
              userId: identity.userId,
            });
          }
        })
      );

      yield* Effect.promise(() =>
        expect(
          test.mutation((ctx) =>
            runConvexProgram(
              saveOnboardingAnswer(ctx, identity.userId, {
                kind: "role",
                value: "student",
              })
            )
          )
        ).rejects.toMatchObject({
          data: {
            code: "ONBOARDING_PERSISTENCE_FAILED",
            message: "Unable to read or persist onboarding progress.",
          },
        })
      );
    })
  );

  it.effect("rejects a managed catalog without the region default", () =>
    Effect.gen(function* () {
      const { identity, test } = yield* createImplTest();
      const data = yield* makeProgramSnapshotData([makeTechnicalProgram(1)]);
      yield* Effect.promise(() => activateProgramSnapshot(test, data));

      yield* Effect.promise(() =>
        expect(
          test.mutation((ctx) =>
            runConvexProgram(
              finishOnboarding(ctx, identity.userId, {
                focus: "learning",
                region: "indonesia",
                role: "student",
              })
            )
          )
        ).rejects.toMatchObject({
          data: {
            code: "ONBOARDING_CURRICULUM_MISSING",
            message: "The default curriculum is unavailable.",
          },
        })
      );
    })
  );

  it.effect("completes a resumed draft without rewriting its lifecycle", () =>
    Effect.gen(function* () {
      const { identity, test } = yield* createImplTest();
      yield* activateOnboardingPrograms(test);
      yield* Effect.promise(() =>
        test.mutation((ctx) =>
          runConvexProgram(
            saveOnboardingAnswer(ctx, identity.userId, {
              kind: "focus",
              value: "learning",
            })
          )
        )
      );
      yield* Effect.sync(() => vi.setSystemTime(NOW + 1000));

      const result = yield* Effect.promise(() =>
        test.mutation((ctx) =>
          runConvexProgram(
            finishOnboarding(ctx, identity.userId, {
              focus: "learning",
              region: "germany",
              role: "teacher",
            })
          )
        )
      );
      const stored = yield* Effect.promise(() =>
        test.query((ctx) => ctx.db.query("onboardingProfiles").unique())
      );

      expect(result).toEqual({
        destination: { kind: "curriculum-program", publicSlug: "cambridge" },
        locale: "de",
      });
      expect(stored).toMatchObject({
        admittedAt: NOW,
        completedAt: NOW + 1000,
        startedAt: NOW,
      });
    })
  );

  it.effect(
    "normalizes lifecycle timestamps when completing a stored draft",
    () =>
      Effect.gen(function* () {
        const { identity, test } = yield* createImplTest();
        yield* activateOnboardingPrograms(test);
        yield* Effect.promise(() =>
          test.mutation((ctx) =>
            ctx.db.insert("onboardingProfiles", {
              focus: "learning",
              updatedAt: NOW - 1000,
              userId: identity.userId,
            })
          )
        );

        yield* Effect.promise(() =>
          test.mutation((ctx) =>
            runConvexProgram(
              finishOnboarding(ctx, identity.userId, {
                focus: "learning",
                region: "indonesia",
                role: "student",
              })
            )
          )
        );
        const stored = yield* Effect.promise(() =>
          test.query((ctx) => ctx.db.query("onboardingProfiles").unique())
        );

        expect(stored).toMatchObject({
          admittedAt: NOW,
          completedAt: NOW,
          startedAt: NOW,
        });
      })
  );
});
