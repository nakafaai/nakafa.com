import { describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import {
  activateTryoutStartSource,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_NOW,
  TRYOUT_START_SECTION,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout/source";
import type { FunctionArgs } from "convex/server";

describe("tryouts/start/impl", () => {
  it("resumes an active attempt without loading the complete signed catalog", async () => {
    vi.setSystemTime(new Date(TRYOUT_START_NOW));
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_START_NOW,
        suffix: "tryout-resume-owner",
      });
      await activateTryoutStartSource(ctx, "internal-entry", "raw");
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
  it("rejects missing immutable navigation and resumes only the frozen entry scope", async () => {
    vi.setSystemTime(new Date(TRYOUT_START_NOW));
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_START_NOW,
        suffix: "frozen-navigation",
      });
      await activateTryoutStartSource(ctx, "visible", "raw");
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
      examKey: TRYOUT_START_EXAM,
      locale: "id",
      setKey: TRYOUT_START_SET,
      trackKey: TRYOUT_START_TRACK,
    };
    const started = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      args
    );
    for (const entrySectionKey of [TRYOUT_START_SECTION, "absent-section"]) {
      await expect(
        authed.mutation(api.tryouts.mutations.attempts.startAttempt, {
          ...args,
          entrySectionKey,
        })
      ).resolves.toEqual(started);
    }
    await expect(
      authed.mutation(api.tryouts.mutations.attempts.startAttempt, {
        ...args,
        destinationSectionKey: "absent-section",
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_SECTION_SNAPSHOT_MISMATCH" },
    });
    await t.mutation((ctx) =>
      ctx.db.patch("tryoutAttempts", started.attemptId, { setPublicPath: "" })
    );
    await expect(
      authed.mutation(api.tryouts.mutations.attempts.startAttempt, args)
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_SECTION_SNAPSHOT_MISMATCH" },
    });
  });

  it("scores an expired predecessor before opening the next free attempt", async () => {
    vi.setSystemTime(new Date(TRYOUT_START_NOW));
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_START_NOW,
        suffix: "expired-free-restart",
      });
      await activateTryoutStartSource(ctx, "internal-entry", "raw");
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
      examKey: TRYOUT_START_EXAM,
      locale: "id",
      setKey: TRYOUT_START_SET,
      trackKey: TRYOUT_START_TRACK,
      entrySectionKey: TRYOUT_START_SECTION,
    };
    const first = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      args
    );
    await t.mutation((ctx) =>
      ctx.db.patch("tryoutAttempts", first.attemptId, {
        expiresAt: TRYOUT_START_NOW,
      })
    );
    const second = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      args
    );
    expect(second.attemptId).not.toBe(first.attemptId);
    const rows = await t.query(async (ctx) => ({
      first: await ctx.db.get("tryoutAttempts", first.attemptId),
      second: await ctx.db.get("tryoutAttempts", second.attemptId),
      score: await ctx.db
        .query("tryoutScores")
        .withIndex("by_tryoutAttemptId", (query) =>
          query.eq("tryoutAttemptId", first.attemptId)
        )
        .unique(),
    }));
    expect(rows.first).toMatchObject({ status: "expired" });
    expect(rows.second).toMatchObject({
      attemptNumber: 2,
      accessSourceKind: "free",
      status: "in-progress",
    });
    expect(rows.score).toMatchObject({ totalQuestions: 1, totalCorrect: 0 });
  });
});
