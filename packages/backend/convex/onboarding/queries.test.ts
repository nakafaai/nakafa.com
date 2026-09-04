import { describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 7, 31, 12, 0, 0);

describe("onboarding/queries", () => {
  it.effect("reports signed-out onboarding state", () =>
    Effect.gen(function* () {
      const test = createConvexTestWithBetterAuth();

      const status = yield* Effect.promise(() =>
        test.query(api.onboarding.queries.getStatus, {})
      );

      expect(status).toEqual({
        isAuthenticated: false,
        isRequired: false,
        profile: null,
      });
    })
  );

  it.effect("reports onboarding as required for a new account", () =>
    Effect.gen(function* () {
      const test = createConvexTestWithBetterAuth();
      const identity = yield* Effect.promise(() =>
        test.mutation((ctx) =>
          seedAuthenticatedUser(ctx, {
            now: NOW,
            suffix: "onboarding-query-new-account",
          })
        )
      );
      const authenticated = test.withIdentity({
        sessionId: identity.sessionId,
        subject: identity.authUserId,
      });

      const status = yield* Effect.promise(() =>
        authenticated.query(api.onboarding.queries.getStatus, {})
      );

      expect(status).toEqual({
        isAuthenticated: true,
        isRequired: true,
        profile: null,
      });
    })
  );

  it.effect("redacts inconsistent account linkage", () =>
    Effect.gen(function* () {
      const test = createConvexTestWithBetterAuth();
      const identity = yield* Effect.promise(() =>
        test.mutation((ctx) =>
          seedAuthenticatedUser(ctx, {
            now: NOW,
            suffix: "onboarding-query-linkage",
          })
        )
      );
      yield* Effect.promise(() =>
        test.mutation((ctx) =>
          ctx.db.insert("users", {
            authId: identity.authUserId,
            credits: 0,
            creditsResetAt: NOW,
            email: "duplicate-query-linkage@example.com",
            name: "Duplicate Query Linkage",
            plan: "free",
          })
        )
      );
      const authenticated = test.withIdentity({
        sessionId: identity.sessionId,
        subject: identity.authUserId,
      });

      yield* Effect.promise(() =>
        expect(
          authenticated.query(api.onboarding.queries.getStatus, {})
        ).rejects.toMatchObject({
          data: {
            code: "ONBOARDING_READ_FAILED",
            message: "Unable to read onboarding progress.",
          },
        })
      );
    })
  );
});
