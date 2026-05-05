import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 3, 2, 12, 0, 0);

describe("triggers/contents/views", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("captures signed-in content views after the engaged view write", async () => {
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
});
