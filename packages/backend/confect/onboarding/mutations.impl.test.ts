import { describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import { createOnboardingTest } from "@repo/backend/test/onboarding";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 7, 31, 12, 0, 0);

describe("onboarding admission", () => {
  it.effect("records first-run admission exactly once", () =>
    Effect.gen(function* () {
      const { authenticated, test } = yield* createOnboardingTest(NOW);
      const first = yield* Effect.promise(() =>
        authenticated.mutation(api.onboarding.mutations.admit, {})
      );
      vi.setSystemTime(NOW + 1000);
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
        profile: {
          updatedAt: NOW,
        },
      });
      expect(repeated).toEqual(first);
      expect(stored).toMatchObject({
        admittedAt: NOW,
        updatedAt: NOW,
      });
      expect(stored?.startedAt).toBeUndefined();
      expect(status).toEqual(first);
    })
  );
  it.effect("keeps privileged admission outside learner lifecycle state", () =>
    Effect.gen(function* () {
      const { authenticated, test } = yield* createOnboardingTest(
        NOW,
        "administrator"
      );
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
      const { test } = yield* createOnboardingTest(NOW);
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
  it.effect("rejects admission while account deletion is pending", () =>
    Effect.gen(function* () {
      const { authenticated, identity, test } =
        yield* createOnboardingTest(NOW);
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
          data: {
            code: "UNAUTHORIZED",
            message: "User not found.",
          },
        })
      );
    })
  );
});
