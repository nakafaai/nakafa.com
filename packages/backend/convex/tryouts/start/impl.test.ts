import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import {
  seedTryoutStartSet,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_NOW,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout-start";
import { describe, expect, it, vi } from "vitest";

describe("tryouts/start/impl", () => {
  it("rejects a missing snapshot before claiming access or writing runtime", async () => {
    vi.setSystemTime(new Date(TRYOUT_START_NOW));
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_START_NOW,
        suffix: "tryout-missing-snapshot",
      });
      await seedTryoutStartSet(ctx, {
        activateSnapshot: false,
        userId: user.userId,
        visibility: "visible",
      });
      return user;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    await expect(
      authed.mutation(api.tryouts.mutations.attempts.startAttempt, {
        countryKey: TRYOUT_START_COUNTRY,
        examKey: TRYOUT_START_EXAM,
        locale: "id",
        setKey: TRYOUT_START_SET,
        trackKey: TRYOUT_START_TRACK,
      })
    ).rejects.toThrow("TRYOUT_SNAPSHOT_UNAVAILABLE");
    const state = await t.query(async (ctx) => ({
      attempts: await ctx.db.query("tryoutAttempts").take(1),
      claims: await ctx.db.query("tryoutFreeAttemptClaims").take(1),
      placements: await ctx.db.query("tryoutAttemptPlacements").take(1),
      progress: await ctx.db.query("tryoutSetProgress").take(1),
    }));

    expect(state).toEqual({
      attempts: [],
      claims: [],
      placements: [],
      progress: [],
    });
  });
});
