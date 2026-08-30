// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  expectPublicJson,
  fetchApi,
  restoreApiSecret,
  stubApiSecret,
} from "@repo/backend/test/agent/http";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content/runtime";
import { insertRuntimeIndex } from "@repo/backend/test/runtime/head";
import { TEST_RUNTIME_RELEASE } from "@repo/backend/test/runtime/values";

beforeEach(stubApiSecret);
afterEach(restoreApiSecret);

describe("public agent search", () => {
  it("returns stable empty pagination from an empty deployment", async () => {
    const response = await fetchApi(
      createConvexTestWithBetterAuth(),
      "/search?query=algebra&locale=en&limit=10&offset=0"
    );

    expect(response.status).toBe(200);
    expectPublicJson(response);
    await expect(response.json()).resolves.toMatchObject({
      count: 0,
      has_more: false,
      items: [],
      limit: 10,
      offset: 0,
    });
  });

  it("searches one authenticated current article", async () => {
    const test = createConvexTestWithBetterAuth();
    const article = testArticleProjection(0);
    await test.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 1);
      await insertRuntimeIndex(ctx, article.contentKey, {
        plainText: "rational function grade eleven asymptote",
      });
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        expect.fail("Expected one active content state.");
      }
      await ctx.db.patch("contentState", state._id, {
        searchManifestHash: TEST_RUNTIME_RELEASE.manifestHash,
        searchReleaseId: TEST_RUNTIME_RELEASE.releaseId,
        searchSequence: TEST_RUNTIME_RELEASE.sequence,
      });
    });
    const response = await fetchApi(
      test,
      "/search?query=rational%20function&locale=en&section=articles"
    );

    expect(response.status).toBe(200);
    expectPublicJson(response);
    await expect(response.json()).resolves.toMatchObject({
      count: 1,
      has_more: false,
      items: [
        {
          content_id: article.graph.assetId,
          route: article.publicPath,
          section: "articles",
          title: article.metadata.title,
        },
      ],
    });
  });
});
