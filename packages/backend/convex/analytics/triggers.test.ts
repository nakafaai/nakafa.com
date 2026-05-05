import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { afterEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 3, 2, 12, 0, 0);

describe("analytics/triggers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("captures signed-in content views after the engaged view write", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, { now: NOW });

      await ctx.db.insert("articleContents", {
        articleSlug: "analytics",
        body: "content",
        category: "politics",
        contentHash: "hash",
        date: NOW,
        locale: "id",
        slug: "articles/politics/analytics",
        syncedAt: NOW,
        title: "Analytics",
      });

      return identity;
    });

    await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .mutation(api.contents.mutations.views.recordContentView, {
        contentRef: {
          slug: "articles/politics/analytics",
          type: "article",
        },
        deviceId: "device-1",
        locale: "id",
      });

    const scheduledJobs = await t.query(
      async (ctx) => await ctx.db.system.query("_scheduled_functions").collect()
    );

    expect(scheduledJobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          args: [
            expect.objectContaining({
              distinctId: identity.userId,
              event: "content viewed",
              properties: JSON.stringify({
                content_type: "article",
                is_new_view: true,
                locale: "id",
                slug: "articles/politics/analytics",
              }),
            }),
          ],
        }),
      ])
    );
  });

  it("captures exercise start and completion from the attempt lifecycle", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(
      async (ctx) => await seedAuthenticatedUser(ctx, { now: NOW })
    );
    const client = t.withIdentity({
      subject: identity.authUserId,
      sessionId: identity.sessionId,
    });

    const attemptId = await client.mutation(
      api.exercises.mutations.startAttempt,
      {
        mode: "practice",
        scope: "set",
        slug: "exercises/high-school/snbt/set-1",
        timeLimit: 600,
        totalExercises: 10,
      }
    );

    await client.mutation(api.exercises.mutations.completeAttempt, {
      attemptId,
    });

    const scheduledJobs = await t.query(
      async (ctx) => await ctx.db.system.query("_scheduled_functions").collect()
    );

    expect(scheduledJobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          args: [
            expect.objectContaining({
              distinctId: identity.userId,
              event: "exercise attempt started",
              properties: JSON.stringify({
                mode: "practice",
                origin: "standalone",
                scope: "set",
                slug: "exercises/high-school/snbt/set-1",
                total_exercises: 10,
              }),
            }),
          ],
        }),
        expect.objectContaining({
          args: [
            expect.objectContaining({
              distinctId: identity.userId,
              event: "exercise attempt completed",
              properties: JSON.stringify({
                answered_count: 0,
                correct_answers: 0,
                mode: "practice",
                origin: "standalone",
                score_percentage: 0,
                scope: "set",
                slug: "exercises/high-school/snbt/set-1",
                total_exercises: 10,
                total_time: 0,
              }),
            }),
          ],
        }),
      ])
    );
  });
});
