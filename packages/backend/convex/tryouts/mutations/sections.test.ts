import { describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import {
  TRYOUT_TEST_NOW as NOW,
  TRYOUT_SECTION_KEY,
} from "@repo/backend/test/tryouts";

describe("tryouts/mutations/sections", () => {
  it.each(["terminal", "expired"])(
    "rejects completion of an %s attempt without scoring",
    async (kind) => {
      vi.setSystemTime(new Date(NOW));
      const t = createConvexTestWithBetterAuth();
      const fixture = await t.mutation(async (ctx) => {
        const seeded = await seedTryoutContentAccessState(ctx, {
          attemptStatus: kind === "terminal" ? "completed" : "in-progress",
          sectionStatus: "in-progress",
          suffix: `complete-${kind}`,
        });
        if (kind === "expired") {
          await ctx.db.patch(seeded.attemptId, { expiresAt: NOW });
        }
        return seeded;
      });
      const client = t.withIdentity({
        sessionId: fixture.identity.sessionId,
        subject: fixture.identity.authUserId,
      });
      await expect(
        client.mutation(api.tryouts.mutations.sections.complete, {
          attemptId: fixture.attemptId,
          sectionKey: TRYOUT_SECTION_KEY,
        })
      ).rejects.toMatchObject({ data: { code: "TRYOUT_ATTEMPT_NOT_ACTIVE" } });
      expect(
        await t.query((ctx) => ctx.db.query("tryoutScores").collect())
      ).toEqual([]);
    }
  );

  it("scores a timed-out section after its subscription attribution expires", async () => {
    vi.setSystemTime(new Date(NOW));
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation(async (ctx) => {
      const seeded = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        suffix: "expired-attribution",
      });
      await ctx.db.patch(seeded.attemptId, {
        accessEndsAt: NOW - 1000,
        accessSourceKind: "subscription",
        scoringStrategy: "raw",
      });
      await ctx.db.patch(seeded.sectionAttemptId, { expiresAt: NOW });
      return seeded;
    });
    const client = t.withIdentity({
      sessionId: fixture.identity.sessionId,
      subject: fixture.identity.authUserId,
    });
    await expect(
      client.mutation(api.tryouts.mutations.sections.complete, {
        attemptId: fixture.attemptId,
        sectionKey: TRYOUT_SECTION_KEY,
      })
    ).resolves.toEqual({ kind: "completed" });
    const rows = await t.query(async (ctx) => ({
      attempt: await ctx.db.get(fixture.attemptId),
      section: await ctx.db.get(fixture.sectionAttemptId),
      score: await ctx.db.query("tryoutScores").first(),
    }));
    expect(rows.attempt).toMatchObject({ status: "completed" });
    expect(rows.section).toMatchObject({
      status: "expired",
      endReason: "time-expired",
    });
    expect(rows.score).toMatchObject({ rawScore: 0, totalQuestions: 1 });
  });
});
