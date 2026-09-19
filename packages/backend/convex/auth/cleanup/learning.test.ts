import { expect, it } from "@effect/vitest";
import { cleanupUserLearningData } from "@repo/backend/convex/auth/cleanup/learning";
import { createDeletedUserTombstone } from "@repo/backend/convex/auth/deletion/tombstone";
import { createCanonicalLearningContext } from "@repo/backend/convex/contents/context";
import { createPopularityViewerKey } from "@repo/backend/convex/contents/popularity";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";

const learningTables = [
  "onboardingProfiles",
  "learningPreferences",
  "chatTurns",
  "creditTransactions",
  "learningViews",
  "userLearningRecents",
  "learningEngagementQueue",
  "learningPopularityViewerSignals",
] as const;

it("drains deleted-user holds before their ledger, keeps each batch bounded, and preserves another learner", async () => {
  const t = createConvexTestWithBetterAuth();
  const identity = await t.mutation(async (ctx) => {
    const removed = await seedAuthenticatedUser(ctx, {
      now: Date.now(),
      suffix: "removed",
    });
    const retained = await seedAuthenticatedUser(ctx, {
      now: Date.now(),
      suffix: "retained",
    });
    await ctx.db.patch(
      "users",
      removed.userId,
      createDeletedUserTombstone(removed.userId, Date.now())
    );
    for (const user of [removed, retained]) {
      const userId = user.userId;
      const now = Date.now();
      await ctx.db.insert("onboardingProfiles", { userId, updatedAt: now });
      await ctx.db.insert("learningPreferences", { userId, updatedAt: now });
      for (
        let index = 0;
        index < (userId === removed.userId ? 26 : 1);
        index += 1
      ) {
        const transactionId = await ctx.db.insert("creditTransactions", {
          userId,
          amount: -2,
          balanceAfter: 8,
          type: "usage",
        });
        await ctx.db.insert("chatTurns", {
          userId,
          modelId: "nakafa-lite",
          credits: 2,
          creditsResetAt: now,
          transactionId,
        });
      }
      const graph = {
        alignmentId: "alignment",
        assetId: "asset",
        conceptId: "concept",
        learningObjectId: "object",
        lensId: "lens",
        content_id: "asset",
        ...createCanonicalLearningContext(),
        locale: "en" as const,
        section: "material" as const,
      };
      const content = {
        ...graph,
        route: "/en/subjects/math",
        sourcePath: "math",
        title: "Math",
      };
      const viewerKey = createPopularityViewerKey({
        userId,
        deviceId: "device",
      });
      await ctx.db.insert("learningViews", {
        ...graph,
        userId,
        deviceId: "device",
        firstViewedAt: now,
        lastViewedAt: now,
        route: content.route,
      });
      await ctx.db.insert("userLearningRecents", {
        ...content,
        userId,
        lastViewedAt: now,
      });
      await ctx.db.insert("learningEngagementQueue", {
        ...content,
        viewerKey,
        insertedAt: now,
        viewedAt: now,
        partition: 0,
        scopeMode: "global",
      });
      await ctx.db.insert("learningPopularityViewerSignals", {
        ...graph,
        viewerKey,
        viewedAt: now,
        signalDay: now,
        scopeMode: "global",
      });
    }
    return { removed, retained };
  });
  for (let batch = 0; batch < 3; batch += 1) {
    expect(
      await t.mutation((ctx) =>
        runConvexProgram(cleanupUserLearningData(ctx, identity.removed.userId))
      )
    ).toBe(true);
  }
  const during = await t.query(async (ctx) => ({
    holds: await ctx.db
      .query("chatTurns")
      .withIndex("by_userId", (q) => q.eq("userId", identity.removed.userId))
      .collect(),
    transactions: await ctx.db
      .query("creditTransactions")
      .withIndex("by_userId", (q) => q.eq("userId", identity.removed.userId))
      .collect(),
  }));
  expect(during.holds).toHaveLength(1);
  expect(during.transactions).toHaveLength(26);
  let finished = false;
  for (let batch = 0; batch < 10; batch += 1) {
    if (
      !(await t.mutation((ctx) =>
        runConvexProgram(cleanupUserLearningData(ctx, identity.removed.userId))
      ))
    ) {
      finished = true;
      break;
    }
  }
  expect(finished).toBe(true);
  for (const table of learningTables) {
    const remaining = await t.query((ctx) => ctx.db.query(table).collect());
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toEqual(
      expect.objectContaining(
        table === "learningEngagementQueue" ||
          table === "learningPopularityViewerSignals"
          ? {
              viewerKey: createPopularityViewerKey({
                userId: identity.retained.userId,
                deviceId: "device",
              }),
            }
          : { userId: identity.retained.userId }
      )
    );
  }
});
