import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAnalyticsConsent,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 3, 2, 12, 0, 0);

describe("triggers/contents/views", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("captures signed-in current article views after the engaged write", async () => {
    const t = createConvexTestWithBetterAuth();
    const projection = testArticleProjection(0);
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, { now: NOW });
      await seedAnalyticsConsent(ctx, {
        decidedAt: NOW,
        userId: identity.userId,
      });
      await insertRuntimeArticles(ctx, 1, () => projection);
      return identity;
    });

    await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .mutation(api.contents.mutations.views.recordContentView, {
        contentId: projection.graph.assetId,
        deviceId: "device-1",
        locale: "en",
        publicPath: projection.publicPath,
        section: "articles",
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
                alignment_id: projection.graph.alignmentId,
                concept_id: projection.graph.conceptId,
                content_id: projection.graph.assetId,
                context_key: "canonical",
                content_type: "article",
                is_new_view: true,
                learning_object_id: projection.graph.learningObjectId,
                lens_id: projection.graph.lensId,
                locale: "en",
                route: projection.publicPath,
              }),
            }),
          ],
        }),
      ])
    );
  });
});
