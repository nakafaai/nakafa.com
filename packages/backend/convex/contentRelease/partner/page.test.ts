import { describe, expect, it } from "@effect/vitest";
import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import { MaterialLessonProjectionSchema } from "@nakafa/aksara-contracts/projection/material";
import { api } from "@repo/backend/convex/_generated/api";
import { INITIAL_MODEL_SLOT } from "@repo/backend/convex/contentRelease/models/slot";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content/runtime";
import {
  activateMaterialCatalog,
  advanceMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material/catalog";
import { TEST_RUNTIME_RELEASE } from "@repo/backend/test/runtime/values";
import { convexTest } from "convex-test";

const ARTICLE_PREFIX = "articles/politics";
const ARTICLE_CURSOR_PATTERN = /^content:article:/;
const MATERIAL_CURSOR_PATTERN = /^content:material:/;
const MATERIAL_PREFIX = "material/lesson/mathematics";

describe("contentRelease/partner/page", () => {
  it.each([
    {
      family: "article" as const,
      query: api.contentRelease.article.apiPage,
    },
    {
      family: "material" as const,
      query: api.contentRelease.material.apiPage,
    },
  ])("requires an active signed $family owner", async ({ family, query }) => {
    const target = convexTest(schema, convexModules);

    await expect(
      target.query(query, {
        cursor: null,
        limit: 1,
        appLocale: "en",
        prefix: family === "article" ? ARTICLE_PREFIX : MATERIAL_PREFIX,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_MISSING" },
    });
  });

  it("paginates current signed articles", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation((ctx) => insertRuntimeArticles(ctx, 2));

    const first = await target.query(api.contentRelease.article.apiPage, {
      cursor: null,
      limit: 1,
      appLocale: "en",
      prefix: ARTICLE_PREFIX,
    });

    expect(first).toEqual({
      activeReleaseId: TEST_RUNTIME_RELEASE.releaseId,
      continueCursor: expect.stringMatching(ARTICLE_CURSOR_PATTERN),
      isDone: false,
      page: [
        {
          appLocale: "en",
          publicPath: testArticleProjection(0).publicPath,
        },
      ],
    });
    await expect(
      target.query(api.contentRelease.article.apiPage, {
        cursor: first.continueCursor,
        limit: 1,
        appLocale: "en",
        prefix: ARTICLE_PREFIX,
      })
    ).resolves.toEqual({
      activeReleaseId: TEST_RUNTIME_RELEASE.releaseId,
      continueCursor: "",
      isDone: true,
      page: [
        {
          appLocale: "en",
          publicPath: testArticleProjection(1).publicPath,
        },
      ],
    });
  });

  it("paginates current signed materials", async () => {
    const target = convexTest(schema, convexModules);
    const first = makeMaterialProjection("en", 1);
    const second = makeMaterialProjection("en", 2);
    await activateMaterialCatalog(target, [first, second]);

    const page = await target.query(api.contentRelease.material.apiPage, {
      cursor: null,
      limit: 1,
      appLocale: "en",
      prefix: MATERIAL_PREFIX,
    });

    expect(page).toEqual({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
      continueCursor: expect.stringMatching(MATERIAL_CURSOR_PATTERN),
      isDone: false,
      page: [{ appLocale: "en", publicPath: first.publicPath }],
    });
    await expect(
      target.query(api.contentRelease.material.apiPage, {
        cursor: page.continueCursor,
        limit: 1,
        appLocale: "en",
        prefix: MATERIAL_PREFIX,
      })
    ).resolves.toEqual({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
      continueCursor: "",
      isDone: true,
      page: [{ appLocale: "en", publicPath: second.publicPath }],
    });
  });

  it.each(["article", "material"] as const)(
    "normalizes an unfiltered %s prefix across continuation pages",
    async (family) => {
      const target = convexTest(schema, convexModules);
      const query =
        family === "article"
          ? api.contentRelease.article.apiPage
          : api.contentRelease.material.apiPage;
      const paths =
        family === "article"
          ? [
              testArticleProjection(0).publicPath,
              testArticleProjection(1).publicPath,
            ]
          : [
              makeMaterialProjection("en", 1).publicPath,
              makeMaterialProjection("en", 2).publicPath,
            ];
      if (family === "article") {
        await target.mutation((ctx) => insertRuntimeArticles(ctx, 2));
      } else {
        await activateMaterialCatalog(target);
      }
      const first = await target.query(query, {
        appLocale: "en",
        cursor: null,
        limit: 1,
        prefix: "///",
      });
      const second = await target.query(query, {
        appLocale: "en",
        cursor: first.continueCursor,
        limit: 1,
        prefix: "",
      });
      expect(first.isDone).toBe(false);
      expect(second).toMatchObject({ isDone: true, continueCursor: "" });
      expect(
        [...first.page, ...second.page].map((row) => row.publicPath)
      ).toEqual(paths);
    }
  );

  it.each(["article", "material"] as const)(
    "authenticates the %s lookahead row before returning a continuation",
    async (family) => {
      const target = convexTest(schema, convexModules);
      const query =
        family === "article"
          ? api.contentRelease.article.apiPage
          : api.contentRelease.material.apiPage;
      if (family === "article") {
        await target.mutation((ctx) => insertRuntimeArticles(ctx, 2));
      } else {
        await activateMaterialCatalog(target);
      }
      await target.mutation(async (ctx) => {
        if (family === "article") {
          const row = await ctx.db
            .query("articleCatalog")
            .withIndex("by_slot_and_appLocale_and_contentKey", (index) =>
              index.eq("slot", INITIAL_MODEL_SLOT).eq("appLocale", "en")
            )
            .order("desc")
            .first();
          if (!row) {
            throw new Error("Expected an article continuation fixture.");
          }
          await ctx.db.patch("articleCatalog", row._id, {
            publicPath: "articles/foreign",
          });
          return;
        }
        const row = await ctx.db
          .query("materialCatalog")
          .withIndex("by_slot_and_appLocale_and_contentKey", (index) =>
            index.eq("slot", INITIAL_MODEL_SLOT).eq("appLocale", "en")
          )
          .order("desc")
          .first();
        if (!row) {
          throw new Error("Expected a material continuation fixture.");
        }
        await ctx.db.patch("materialCatalog", row._id, {
          projectionJson: "{}",
        });
      });
      await expect(
        target.query(query, {
          appLocale: "en",
          cursor: null,
          limit: 1,
          prefix: "",
        })
      ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
    }
  );

  it("preserves Convex index ordering across punctuation keys", async () => {
    const target = convexTest(schema, convexModules);
    const dot = MaterialLessonProjectionSchema.make({
      ...makeMaterialProjection("en", 1),
      contentKey: ContentKeySchema.make(`${MATERIAL_PREFIX}/item.one`),
    });
    const colon = MaterialLessonProjectionSchema.make({
      ...makeMaterialProjection("en", 2),
      contentKey: ContentKeySchema.make(`${MATERIAL_PREFIX}/item:one`),
    });
    await activateMaterialCatalog(target, [colon, dot]);

    const first = await target.query(api.contentRelease.material.apiPage, {
      cursor: null,
      limit: 1,
      appLocale: "en",
      prefix: MATERIAL_PREFIX,
    });
    expect(first).toMatchObject({
      isDone: false,
      page: [{ appLocale: "en", publicPath: dot.publicPath }],
    });
    await expect(
      target.query(api.contentRelease.material.apiPage, {
        cursor: first.continueCursor,
        limit: 1,
        appLocale: "en",
        prefix: MATERIAL_PREFIX,
      })
    ).resolves.toMatchObject({
      isDone: true,
      page: [{ appLocale: "en", publicPath: colon.publicPath }],
    });
  });

  it("rejects stale, cross-family, mismatched, and invalid cursors", async () => {
    const target = convexTest(schema, convexModules);
    await activateMaterialCatalog(target);
    const page = await target.query(api.contentRelease.material.apiPage, {
      cursor: null,
      limit: 1,
      appLocale: "en",
      prefix: MATERIAL_PREFIX,
    });

    await expect(
      target.query(api.contentRelease.material.apiPage, {
        cursor: page.continueCursor,
        limit: 1,
        appLocale: "id",
        prefix: MATERIAL_PREFIX,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STALE_BASE" },
    });
    await expect(
      target.query(api.contentRelease.article.apiPage, {
        cursor: page.continueCursor,
        limit: 1,
        appLocale: "en",
        prefix: MATERIAL_PREFIX,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
    await advanceMaterialCatalog(target);
    await expect(
      target.query(api.contentRelease.material.apiPage, {
        cursor: page.continueCursor,
        limit: 1,
        appLocale: "en",
        prefix: MATERIAL_PREFIX,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STALE_BASE" },
    });
  });

  it("keeps sibling prefixes out and rejects invalid limits", async () => {
    const target = convexTest(schema, convexModules);
    const exact = makeMaterialProjection("en", 1);
    const sibling = makeMaterialProjection("en", 10);
    await activateMaterialCatalog(target, [exact, sibling]);

    await expect(
      target.query(api.contentRelease.material.apiPage, {
        cursor: null,
        limit: 10,
        appLocale: "en",
        prefix: exact.contentKey,
      })
    ).resolves.toMatchObject({
      isDone: true,
      page: [{ appLocale: "en", publicPath: exact.publicPath }],
    });
    await expect(
      target.query(api.contentRelease.material.apiPage, {
        cursor: null,
        limit: 101,
        appLocale: "en",
        prefix: MATERIAL_PREFIX,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });
});
