import { describe, expect, it } from "@effect/vitest";
import { cleanupUserLearningData } from "@repo/backend/convex/auth/cleanup/learning";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 7, 31);

describe("auth learning cleanup", () => {
  it.effect("deletes the resumable onboarding profile", () =>
    Effect.gen(function* () {
      const test = createConvexTestWithBetterAuth();
      const identity = yield* Effect.promise(() =>
        test.mutation((ctx) => seedAuthenticatedUser(ctx, { now: NOW }))
      );
      yield* Effect.promise(() =>
        test.mutation((ctx) =>
          ctx.db.insert("onboardingProfiles", {
            region: "international",
            updatedAt: NOW,
            userId: identity.userId,
          })
        )
      );

      const deleted = yield* Effect.promise(() =>
        test.mutation((ctx) =>
          runConvexProgram(cleanupUserLearningData(ctx, identity.userId))
        )
      );
      const profile = yield* Effect.promise(() =>
        test.query((ctx) => ctx.db.query("onboardingProfiles").unique())
      );

      expect(deleted).toBe(true);
      expect(profile).toBeNull();
    })
  );
});
