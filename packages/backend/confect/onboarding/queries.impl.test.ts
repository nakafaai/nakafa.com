import { describe, expect, it } from "@effect/vitest";
import {
  createConvexTestWithAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 7, 31, 12, 0, 0);

describe("onboarding/queries", () => {
  it.effect("reports signed-out onboarding state", () =>
    Effect.gen(function* () {
      const test = createConvexTestWithAuth();

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
      const test = createConvexTestWithAuth();
      const identity = yield* Effect.promise(() =>
        test.mutation((ctx) =>
          seedAuthenticatedUser(ctx, {
            now: NOW,
            suffix: "onboarding-query-new-account",
          })
        )
      );
      const authenticated = test.withIdentity({ subject: identity.sessionId });

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
});
