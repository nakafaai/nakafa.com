import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import type { StartAttemptArgs } from "@repo/backend/convex/tryouts/start/spec";
import {
  TRYOUT_START_COUNTRY as COUNTRY,
  TRYOUT_START_EXAM as EXAM,
  TRYOUT_START_NOW as NOW,
  TRYOUT_START_SECTION as SECTION,
  TRYOUT_START_SET as SET,
  TRYOUT_START_TRACK as TRACK,
} from "@repo/backend/test/tryout-source";
import { seedTryoutStartSet } from "@repo/backend/test/tryout-start";
import { describe, expect, it, vi } from "vitest";

const startArgs: StartAttemptArgs = {
  countryKey: COUNTRY,
  examKey: EXAM,
  locale: "id",
  setKey: SET,
  trackKey: TRACK,
};

describe("tryouts/start/source", () => {
  it("rejects entry-section starts for visible sections", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "tryout-visible",
      });
      await seedTryoutStartSet(ctx, {
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
        ...startArgs,
        entrySectionKey: SECTION,
      })
    ).rejects.toThrow("TRYOUT_ENTRY_SECTION_NOT_FOUND");
    await expect(
      t.query((ctx) => ctx.db.query("tryoutFreeAttemptClaims").collect())
    ).resolves.toEqual([]);
  });

  it("rejects a new attempt when legacy and signed sources differ", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "tryout-mismatch",
      });
      const fixture = await seedTryoutStartSet(ctx, {
        userId: user.userId,
        visibility: "visible",
      });
      await ctx.db.patch(fixture.tryoutSetId, { title: "Changed" });
      return user;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    await expect(
      authed.mutation(api.tryouts.mutations.attempts.startAttempt, startArgs)
    ).rejects.toThrow("TRYOUT_SECTION_SNAPSHOT_MISMATCH");
    const writes = await t.query(async (ctx) => ({
      attempts: await ctx.db.query("tryoutAttempts").collect(),
      claims: await ctx.db.query("tryoutFreeAttemptClaims").collect(),
      placements: await ctx.db.query("tryoutAttemptPlacements").collect(),
    }));

    expect(writes).toEqual({ attempts: [], claims: [], placements: [] });
  });
});
