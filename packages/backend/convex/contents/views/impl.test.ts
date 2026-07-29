import { api } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 4, 29, 10, 0, 0);
const ARTICLE_ROUTE = "articles/politics/prepared-viewer";
const ARTICLE_CONTENT_ID = "asset:id:catalog:article:prepared-viewer";

/** Inserts the source article and route projection used by this capability. */
async function insertArticle(ctx: MutationCtx) {
  const graph = createLearningGraphIdentityFromRoute({
    locale: "id",
    route: ARTICLE_ROUTE,
  });

  if (!graph) {
    expect.fail("Unable to build the prepared-viewer graph fixture.");
  }

  await ctx.db.insert("articleContents", {
    articleSlug: "prepared-viewer",
    body: "Prepared viewer article body",
    category: "politics",
    contentHash: "hash-prepared-viewer",
    date: NOW,
    description: "Prepared viewer article description",
    locale: "id",
    slug: ARTICLE_ROUTE,
    syncedAt: NOW,
    title: "Prepared Viewer",
  });
  await ctx.db.insert("contentRoutes", {
    ...graph,
    assetId: ARTICLE_CONTENT_ID,
    authors: [],
    contentHash: "route-hash-prepared-viewer",
    content_id: ARTICLE_CONTENT_ID,
    kind: "article",
    locale: "id",
    markdown: true,
    route: ARTICLE_ROUTE,
    section: "articles",
    sourcePath: ARTICLE_ROUTE,
    syncedAt: NOW,
    title: "Prepared Viewer",
  });
}

describe("contents/views/impl", () => {
  it("does not treat a prepared signed-in viewer as anonymous", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      await insertArticle(ctx);
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "prepared-viewer",
      });
      await ctx.db.patch("users", user.userId, {
        deletionPreparedAt: NOW,
      });

      return user;
    });

    await expect(
      t
        .withIdentity({
          sessionId: identity.sessionId,
          subject: identity.authUserId,
        })
        .mutation(api.contents.mutations.views.recordContentView, {
          contentId: ARTICLE_CONTENT_ID,
          deviceId: "prepared-device",
          locale: "id",
        })
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_VIEW_IO_FAILED",
      },
    });

    const state = await t.query(async (ctx) => ({
      engagementQueue: await ctx.db.query("learningEngagementQueue").collect(),
      scheduledJobs: await ctx.db.system
        .query("_scheduled_functions")
        .collect(),
      viewerSignals: await ctx.db
        .query("learningPopularityViewerSignals")
        .collect(),
      views: await ctx.db.query("learningViews").collect(),
    }));

    expect(state).toEqual({
      engagementQueue: [],
      scheduledJobs: [],
      viewerSignals: [],
      views: [],
    });
  });
});
