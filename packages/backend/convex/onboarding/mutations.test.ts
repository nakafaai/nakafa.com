import { describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { activateOnboardingPrograms } from "@repo/backend/test/onboarding";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 7, 31, 12, 0, 0);

/** Creates one isolated authenticated test boundary for onboarding behavior. */
const createOnboardingTest = Effect.fn("test.onboarding.create")(function* (
  role?: Doc<"users">["role"]
) {
  vi.setSystemTime(new Date(NOW));
  const test = createConvexTestWithBetterAuth();
  const identity = yield* Effect.promise(() =>
    test.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        ...(role === undefined ? {} : { role }),
      })
    )
  );
  return {
    authenticated: test.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    }),
    identity,
    test,
  };
});

describe("onboarding", () => {
  it.effect("records first-run admission exactly once", () =>
    Effect.gen(function* () {
      const { authenticated, test } = yield* createOnboardingTest();

      const first = yield* Effect.promise(() =>
        authenticated.mutation(api.onboarding.mutations.admit, {})
      );
      vi.setSystemTime(new Date(NOW + 1000));
      const repeated = yield* Effect.promise(() =>
        authenticated.mutation(api.onboarding.mutations.admit, {})
      );
      const stored = yield* Effect.promise(() =>
        test.query((ctx) => ctx.db.query("onboardingProfiles").unique())
      );
      const status = yield* Effect.promise(() =>
        authenticated.query(api.onboarding.queries.getStatus, {})
      );

      expect(first).toEqual({
        isAuthenticated: true,
        isRequired: true,
        profile: { updatedAt: NOW },
      });
      expect(repeated).toEqual({
        isAuthenticated: true,
        isRequired: true,
        profile: { updatedAt: NOW },
      });
      expect(stored).toMatchObject({ admittedAt: NOW, updatedAt: NOW });
      expect(stored?.startedAt).toBeUndefined();
      expect(status).toEqual({
        isAuthenticated: true,
        isRequired: true,
        profile: { updatedAt: NOW },
      });
    })
  );

  it.effect("keeps privileged admission outside learner lifecycle state", () =>
    Effect.gen(function* () {
      const { authenticated, test } =
        yield* createOnboardingTest("administrator");

      const admission = yield* Effect.promise(() =>
        authenticated.mutation(api.onboarding.mutations.admit, {})
      );
      const stored = yield* Effect.promise(() =>
        test.query((ctx) => ctx.db.query("onboardingProfiles").unique())
      );

      expect(admission).toEqual({
        isAuthenticated: true,
        isRequired: false,
        profile: null,
      });
      expect(stored).toBeNull();
    })
  );

  it.effect("reports an unauthenticated admission without creating state", () =>
    Effect.gen(function* () {
      const { test } = yield* createOnboardingTest();

      const admission = yield* Effect.promise(() =>
        test.mutation(api.onboarding.mutations.admit, {})
      );
      const stored = yield* Effect.promise(() =>
        test.query((ctx) => ctx.db.query("onboardingProfiles").unique())
      );

      expect(admission).toEqual({
        isAuthenticated: false,
        isRequired: false,
        profile: null,
      });
      expect(stored).toBeNull();
    })
  );

  it.effect(
    "records questionnaire start without rewriting admission time",
    () =>
      Effect.gen(function* () {
        const { authenticated, test } = yield* createOnboardingTest();
        yield* Effect.promise(() =>
          authenticated.mutation(api.onboarding.mutations.admit, {})
        );

        vi.setSystemTime(new Date(NOW + 1000));
        yield* Effect.promise(() =>
          authenticated.mutation(api.onboarding.mutations.saveAnswer, {
            answer: { kind: "region", value: "germany" },
          })
        );
        const stored = yield* Effect.promise(() =>
          test.query((ctx) => ctx.db.query("onboardingProfiles").unique())
        );

        expect(stored).toMatchObject({
          admittedAt: NOW,
          startedAt: NOW + 1000,
          updatedAt: NOW + 1000,
        });
      })
  );

  it.effect(
    "keeps every draft answer separate from applied user settings",
    () =>
      Effect.gen(function* () {
        const { authenticated, identity, test } = yield* createOnboardingTest();

        const profile = yield* Effect.promise(() =>
          authenticated.mutation(api.onboarding.mutations.saveAnswer, {
            answer: { kind: "role", value: "teacher" },
          })
        );
        const stored = yield* Effect.promise(() =>
          test.query(async (ctx) => ({
            preference: await ctx.db.query("learningPreferences").unique(),
            profile: await ctx.db.query("onboardingProfiles").unique(),
            user: await ctx.db.get("users", identity.userId),
          }))
        );

        expect(profile).toEqual({ role: "teacher", updatedAt: NOW });
        expect(stored.preference).toBeNull();
        expect(stored.profile).toMatchObject({
          admittedAt: NOW,
          startedAt: NOW,
        });
        expect(stored.user?.role).toBeUndefined();
      })
  );

  it.effect("applies role and Indonesian curriculum atomically on Finish", () =>
    Effect.gen(function* () {
      const { authenticated, identity, test } = yield* createOnboardingTest();
      yield* activateOnboardingPrograms(test);

      const result = yield* Effect.promise(() =>
        authenticated.mutation(api.onboarding.mutations.finish, {
          answers: {
            focus: "learning",
            region: "indonesia",
            role: "student",
          },
        })
      );
      const admission = yield* Effect.promise(() =>
        authenticated.mutation(api.onboarding.mutations.admit, {})
      );
      const stored = yield* Effect.promise(() =>
        test.query(async (ctx) => ({
          preference: await ctx.db.query("learningPreferences").unique(),
          profile: await ctx.db.query("onboardingProfiles").unique(),
          user: await ctx.db.get("users", identity.userId),
        }))
      );

      expect(result).toEqual({
        destination: {
          kind: "curriculum-program",
          publicSlug: "merdeka",
        },
        locale: "id",
      });
      expect(stored.user?.role).toBe("student");
      expect(admission).toMatchObject({ isRequired: false });
      expect(stored.preference?.preferredCurriculumProgramKey).toBe("merdeka");
      expect(stored.profile?.completedAt).toBe(NOW);
      expect(stored.profile?.admittedAt).toBe(NOW);
      expect(stored.profile?.startedAt).toBe(NOW);
    })
  );

  it.effect(
    "rolls back every setting when the default curriculum is missing",
    () =>
      Effect.gen(function* () {
        const { authenticated, identity, test } = yield* createOnboardingTest();

        yield* Effect.promise(() =>
          expect(
            authenticated.mutation(api.onboarding.mutations.finish, {
              answers: {
                focus: "learning",
                region: "international",
                role: "teacher",
              },
            })
          ).rejects.toMatchObject({
            data: {
              code: "ONBOARDING_CURRICULUM_MISSING",
              message: "The default curriculum is unavailable.",
            },
          })
        );

        const stored = yield* Effect.promise(() =>
          test.query(async (ctx) => ({
            preference: await ctx.db.query("learningPreferences").unique(),
            profile: await ctx.db.query("onboardingProfiles").unique(),
            user: await ctx.db.get("users", identity.userId),
          }))
        );
        expect(stored).toMatchObject({ preference: null, profile: null });
        expect(stored.user?.role).toBeUndefined();
      })
  );

  it.effect(
    "uses English and the Singapore curriculum before opening try-out",
    () =>
      Effect.gen(function* () {
        const { authenticated, test } = yield* createOnboardingTest();
        yield* activateOnboardingPrograms(test);

        const result = yield* Effect.promise(() =>
          authenticated.mutation(api.onboarding.mutations.finish, {
            answers: {
              focus: "tryout",
              region: "singapore",
              role: "parent",
            },
          })
        );
        const preference = yield* Effect.promise(() =>
          test.query((ctx) => ctx.db.query("learningPreferences").unique())
        );

        expect(result).toEqual({
          destination: { kind: "tryout" },
          locale: "en",
        });
        expect(preference?.preferredCurriculumProgramKey).toBe("singapore-moe");
      })
  );

  it.effect("uses German and Cambridge as the Germany default", () =>
    Effect.gen(function* () {
      const { authenticated, identity, test } = yield* createOnboardingTest();
      yield* activateOnboardingPrograms(test);
      yield* Effect.promise(() =>
        test.mutation((ctx) =>
          ctx.db.insert("learningPreferences", {
            preferredCurriculumProgramKey: "merdeka",
            updatedAt: NOW - 1,
            userId: identity.userId,
          })
        )
      );
      const result = yield* Effect.promise(() =>
        authenticated.mutation(api.onboarding.mutations.finish, {
          answers: {
            focus: "learning",
            region: "germany",
            role: "teacher",
          },
        })
      );
      const preference = yield* Effect.promise(() =>
        test.query((ctx) => ctx.db.query("learningPreferences").unique())
      );

      expect(result).toEqual({
        destination: {
          kind: "curriculum-program",
          publicSlug: "cambridge",
        },
        locale: "de",
      });
      expect(preference?.preferredCurriculumProgramKey).toBe(
        "cambridge-international"
      );
    })
  );

  it.effect("does not let a completed profile rewrite user settings", () =>
    Effect.gen(function* () {
      const { authenticated, identity, test } = yield* createOnboardingTest();
      yield* activateOnboardingPrograms(test);
      yield* Effect.promise(() =>
        authenticated.mutation(api.onboarding.mutations.finish, {
          answers: {
            focus: "learning",
            region: "international",
            role: "student",
          },
        })
      );

      yield* Effect.promise(() =>
        expect(
          authenticated.mutation(api.onboarding.mutations.finish, {
            answers: {
              focus: "tryout",
              region: "singapore",
              role: "teacher",
            },
          })
        ).rejects.toMatchObject({
          data: {
            code: "ONBOARDING_ALREADY_COMPLETE",
            message: "Onboarding is already complete.",
          },
        })
      );

      const stored = yield* Effect.promise(() =>
        test.query(async (ctx) => ({
          preference: await ctx.db.query("learningPreferences").unique(),
          profile: await ctx.db.query("onboardingProfiles").unique(),
          user: await ctx.db.get("users", identity.userId),
        }))
      );
      expect(stored.user?.role).toBe("student");
      expect(stored.profile).toMatchObject({
        focus: "learning",
        region: "international",
        role: "student",
      });
      expect(stored.preference?.preferredCurriculumProgramKey).toBe(
        "cambridge-international"
      );
    })
  );

  it.effect("keeps privileged accounts outside self-service onboarding", () =>
    Effect.gen(function* () {
      const { authenticated } = yield* createOnboardingTest("administrator");

      const status = yield* Effect.promise(() =>
        authenticated.query(api.onboarding.queries.getStatus, {})
      );
      expect(status).toEqual({
        isAuthenticated: true,
        isRequired: false,
        profile: null,
      });

      yield* Effect.promise(() =>
        expect(
          authenticated.mutation(api.onboarding.mutations.saveAnswer, {
            answer: { kind: "role", value: "student" },
          })
        ).rejects.toMatchObject({
          data: {
            code: "UNAUTHORIZED",
            message: "This account role cannot be changed through onboarding.",
          },
        })
      );

      yield* Effect.promise(() =>
        expect(
          authenticated.mutation(api.onboarding.mutations.finish, {
            answers: {
              focus: "learning",
              region: "international",
              role: "student",
            },
          })
        ).rejects.toMatchObject({
          data: {
            code: "UNAUTHORIZED",
            message: "This account role cannot be changed through onboarding.",
          },
        })
      );
    })
  );

  it.effect("rejects a signed-out draft write", () =>
    Effect.gen(function* () {
      const { test } = yield* createOnboardingTest();

      yield* Effect.promise(() =>
        expect(
          test.mutation(api.onboarding.mutations.saveAnswer, {
            answer: { kind: "focus", value: "learning" },
          })
        ).rejects.toMatchObject({
          data: { code: "UNAUTHENTICATED", message: "Unauthenticated" },
        })
      );
    })
  );

  it.effect("rejects admission while account deletion is pending", () =>
    Effect.gen(function* () {
      const { authenticated, identity, test } = yield* createOnboardingTest();
      yield* Effect.promise(() =>
        test.mutation((ctx) =>
          ctx.db.patch("users", identity.userId, {
            deletionPreparedAt: NOW,
          })
        )
      );

      yield* Effect.promise(() =>
        expect(
          authenticated.mutation(api.onboarding.mutations.admit, {})
        ).rejects.toMatchObject({
          data: { code: "UNAUTHORIZED", message: "User not found." },
        })
      );
    })
  );

  it.effect("redacts inconsistent account linkage during a draft write", () =>
    Effect.gen(function* () {
      const { authenticated, identity, test } = yield* createOnboardingTest();
      yield* Effect.promise(() =>
        test.mutation((ctx) =>
          ctx.db.insert("users", {
            authId: identity.authUserId,
            credits: 0,
            creditsResetAt: NOW,
            email: "duplicate-mutation-linkage@example.com",
            name: "Duplicate Mutation Linkage",
            plan: "free",
          })
        )
      );

      yield* Effect.promise(() =>
        expect(
          authenticated.mutation(api.onboarding.mutations.saveAnswer, {
            answer: { kind: "role", value: "student" },
          })
        ).rejects.toMatchObject({
          data: {
            code: "ONBOARDING_AUTH_FAILED",
            message: "Unable to authenticate the onboarding request.",
          },
        })
      );
    })
  );
});
