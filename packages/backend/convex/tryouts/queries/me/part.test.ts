import { api } from "@repo/backend/convex/_generated/api";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import {
  createTryoutTestConvex,
  insertCompletedTryoutAttempt,
  insertTryoutSkeleton,
  NOW,
  seedExpiredTryoutWithUntouchedPart,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

describe("tryouts/queries/me/part", () => {
  it("derives part-level and parent attempt scores from theta in part reads", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "part-reporting",
      });
      const tryout = await insertTryoutSkeleton(ctx, "2026-reporting-part");

      await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "2026-reporting-part",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });

      return identity;
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.tryouts.queries.me.part.getUserTryoutPartAttempt, {
        product: "snbt",
        locale: "id",
        tryoutSlug: "2026-reporting-part",
        partKey: "quantitative-knowledge",
      });

    expect(result?.partScore?.irtScore).toBe(500);
    expect(result?.tryoutAttempt.irtScore).toBe(500);
  });

  it("returns zero-score summaries for untouched ended parts", async () => {
    const t = createTryoutTestConvex();
    const { identity, tryoutSlug } = await t.mutation(async (ctx) => {
      return await seedExpiredTryoutWithUntouchedPart(
        ctx,
        "expired-missing-parts"
      );
    });

    const untouchedPartResult = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.tryouts.queries.me.part.getUserTryoutPartAttempt, {
        product: "snbt",
        locale: "id",
        tryoutSlug,
        partKey: "mathematical-reasoning",
      });

    expect(untouchedPartResult?.partAttempt).toBeNull();
    expect(untouchedPartResult?.partScore?.correctAnswers).toBe(0);
    expect(untouchedPartResult?.tryoutAttempt.totalQuestions).toBe(2);

    const startedPartResult = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.tryouts.queries.me.part.getUserTryoutPartAttempt, {
        product: "snbt",
        locale: "id",
        tryoutSlug,
        partKey: "quantitative-knowledge",
      });

    expect(startedPartResult?.partAttempt).not.toBeNull();
    expect(startedPartResult?.tryoutAttempt.totalQuestions).toBe(2);
    expect(startedPartResult?.tryoutAttempt.totalCorrect).toBe(0);
  });
});
