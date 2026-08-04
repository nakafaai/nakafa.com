import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import {
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_NOW,
  TRYOUT_START_SECTION,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout-source";
import { seedTryoutStartSet } from "@repo/backend/test/tryout-start";
import type { FunctionArgs } from "convex/server";
import { describe, expect, it, vi } from "vitest";

describe("tryouts/start/impl", () => {
  it("resumes an active attempt without loading the complete signed catalog", async () => {
    vi.setSystemTime(new Date(TRYOUT_START_NOW));
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_START_NOW,
        suffix: "tryout-resume-owner",
      });
      await seedTryoutStartSet(ctx, {
        userId: user.userId,
        visibility: "internal-entry",
      });
      return user;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const args: FunctionArgs<
      typeof api.tryouts.mutations.attempts.startAttempt
    > = {
      countryKey: TRYOUT_START_COUNTRY,
      entrySectionKey: TRYOUT_START_SECTION,
      examKey: TRYOUT_START_EXAM,
      locale: "id",
      setKey: TRYOUT_START_SET,
      trackKey: TRYOUT_START_TRACK,
    };
    const started = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      args
    );
    await t.mutation(async (ctx) => {
      const row = await ctx.db.query("tryoutCatalog").first();
      if (!row) {
        throw new Error("Expected one signed catalog row.");
      }
      await ctx.db.patch(row._id, { rowHash: "tampered" });
    });

    await expect(
      authed.mutation(api.tryouts.mutations.attempts.startAttempt, args)
    ).resolves.toEqual(started);
  });
});
