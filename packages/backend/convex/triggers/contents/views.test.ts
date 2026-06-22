import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 3, 2, 12, 0, 0);
const ARTICLE_ROUTE = "articles/politics/analytics";
const ARTICLE_CONTENT_ID = "asset:id:catalog:article:analytics";

/** Builds the article graph fixture used by the content-view trigger test. */
function getArticleGraphFixture() {
  const graph = createLearningGraphIdentityFromRoute({
    locale: "id",
    route: ARTICLE_ROUTE,
  });

  if (!graph) {
    throw new Error(
      `Unable to build graph fixture for route "${ARTICLE_ROUTE}".`
    );
  }

  return graph;
}

describe("triggers/contents/views", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("captures signed-in content views after the engaged view write", async () => {
    const t = createConvexTestWithBetterAuth();
    const graph = getArticleGraphFixture();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, { now: NOW });

      await ctx.db.insert("articleContents", {
        articleSlug: "analytics",
        body: "content",
        category: "politics",
        contentHash: "hash",
        date: NOW,
        locale: "id",
        slug: ARTICLE_ROUTE,
        syncedAt: NOW,
        title: "Analytics",
      });
      await ctx.db.insert("contentRoutes", {
        ...graph,
        assetId: ARTICLE_CONTENT_ID,
        authors: [],
        contentHash: "route-hash",
        content_id: ARTICLE_CONTENT_ID,
        kind: "article",
        locale: "id",
        markdown: true,
        route: ARTICLE_ROUTE,
        section: "articles",
        sourcePath: ARTICLE_ROUTE,
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
        contentId: ARTICLE_CONTENT_ID,
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
                alignment_id: graph.alignmentId,
                concept_id: graph.conceptId,
                content_id: ARTICLE_CONTENT_ID,
                context_key: "canonical",
                content_type: "article",
                is_new_view: true,
                learning_object_id: graph.learningObjectId,
                lens_id: graph.lensId,
                locale: "id",
                route: ARTICLE_ROUTE,
              }),
            }),
          ],
        }),
      ])
    );
  });
});
