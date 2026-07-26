import { MaterialLessonProjectionSchema } from "@nakafa/aksara-contracts/projection/material";
import { loadContentTarget } from "@repo/backend/convex/contents/views/target";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  FUNCTION_MATERIAL_V2,
  makeMaterialProjection,
} from "@repo/backend/test/content-material";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content-runtime";
import {
  ARTICLE_VIEW_ID,
  ARTICLE_VIEW_ROUTE,
  insertContentViewArticle,
  insertContentViewRoute,
  insertContentViewSubject,
  insertContentViewTryout,
  SUBJECT_VIEW_ROUTE,
  TRYOUT_VIEW_ROUTE,
} from "@repo/backend/test/content-view";
import { activateMaterialCatalog } from "@repo/backend/test/material-catalog";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { convexTest, type TestConvex } from "convex-test";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

const SOURCE_PATH = "articles/politics/source-target";
const PUBLISHED_SOURCE_PATTERN = /^packages\/corpus\//u;
const PUBLISHED_MATERIAL = Schema.decodeUnknownSync(
  MaterialLessonProjectionSchema
)({
  ...FUNCTION_MATERIAL_V2,
  topicTitle: "Function Composition and Inverse Function",
});

/** Inserts one route-catalog target whose family remains source-owned. */
async function insertSourceTarget(target: TestConvex<typeof schema>) {
  const graph = createLearningGraphIdentityFromRoute({
    locale: "en",
    route: SOURCE_PATH,
  });
  if (!graph) {
    throw new Error("Expected one source-owned article graph identity.");
  }
  await target.mutation((ctx) =>
    ctx.db.insert("contentRoutes", {
      ...graph,
      authors: [],
      contentHash: "source-target-hash",
      content_id: graph.assetId,
      kind: "article",
      locale: "en",
      markdown: true,
      route: SOURCE_PATH,
      section: "articles",
      sourcePath: `packages/contents/${SOURCE_PATH}/en.mdx`,
      syncedAt: 1,
      title: "Source target",
    })
  );
  return graph;
}

describe("contents/views/target", () => {
  it("returns a best-effort miss when no current route owns the identity", async () => {
    const target = convexTest(schema, convexModules);

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          loadContentTarget(ctx, {
            contentId: "asset:id:missing",
            locale: "id",
            publicPath: "articles/politics/missing",
            section: "articles",
          })
        )
      )
    ).resolves.toBeNull();
  });

  it("resolves one unmanaged route without inventing source facts", async () => {
    const target = convexTest(schema, convexModules);
    const graph = await insertSourceTarget(target);

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          loadContentTarget(ctx, {
            contentId: graph.assetId,
            locale: "en",
            publicPath: SOURCE_PATH,
            section: "articles",
          })
        )
      )
    ).resolves.toMatchObject({
      content_id: graph.assetId,
      route: SOURCE_PATH,
      section: "articles",
      sourcePath: `packages/contents/${SOURCE_PATH}/en.mdx`,
    });
  });

  it("resolves active materials by current path and stable asset identity", async () => {
    const target = convexTest(schema, convexModules);
    await activateMaterialCatalog(target, [PUBLISHED_MATERIAL]);
    const input = {
      contentId: PUBLISHED_MATERIAL.graph.assetId,
      locale: PUBLISHED_MATERIAL.locale,
      section: "material",
    } as const;

    const byPath = await target.query((ctx) =>
      runConvexProgram(
        loadContentTarget(ctx, {
          ...input,
          publicPath: PUBLISHED_MATERIAL.publicPath,
        })
      )
    );
    const byIdentity = await target.query((ctx) =>
      runConvexProgram(loadContentTarget(ctx, input))
    );

    expect(byPath).toMatchObject({
      content_id: PUBLISHED_MATERIAL.graph.assetId,
      materialDomain: "mathematics",
      materialKey: PUBLISHED_MATERIAL.materialKey,
      route: PUBLISHED_MATERIAL.publicPath,
      sourcePath: expect.stringContaining(PUBLISHED_MATERIAL.contentKey),
    });
    expect(byIdentity).toEqual(byPath);
  });

  it("does not revive stale material routes after ownership activates", async () => {
    const target = convexTest(schema, convexModules);
    const graph = await insertSourceTarget(target);
    await activateMaterialCatalog(target, [PUBLISHED_MATERIAL]);

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          loadContentTarget(ctx, {
            contentId: graph.assetId,
            locale: "en",
            publicPath: SOURCE_PATH,
            section: "material",
          })
        )
      )
    ).resolves.toBeNull();
  });

  it("resolves active articles without depending on source route rows", async () => {
    const target = convexTest(schema, convexModules);
    const projection = testArticleProjection(0);
    await target.mutation((ctx) => insertRuntimeArticles(ctx, 1));

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          loadContentTarget(ctx, {
            contentId: projection.graph.assetId,
            locale: projection.locale,
            publicPath: projection.publicPath,
            section: "articles",
          })
        )
      )
    ).resolves.toMatchObject({
      content_id: projection.graph.assetId,
      route: projection.publicPath,
      sourcePath: expect.stringMatching(PUBLISHED_SOURCE_PATTERN),
      title: projection.metadata.title,
    });
  });

  it("rejects active material taxonomy outside the application registry", async () => {
    const target = convexTest(schema, convexModules);
    const projection = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target, [projection]);

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          loadContentTarget(ctx, {
            contentId: projection.graph.assetId,
            locale: projection.locale,
            publicPath: projection.publicPath,
            section: "material",
          })
        )
      )
    ).resolves.toBeNull();
  });

  it("rejects source route kinds without tracked content bodies", async () => {
    const target = convexTest(schema, convexModules);
    const routes = await target.mutation(async (ctx) => ({
      curriculum: await insertContentViewRoute(ctx, {
        contentId: "asset:id:catalog:curriculum-topic:views",
        kind: "curriculum-topic",
        route: "material/lesson/mathematics/vector",
        section: "material",
        title: "Vector",
      }),
      quran: await insertContentViewRoute(ctx, {
        contentId: "asset:id:catalog:quran:1",
        kind: "quran-surah",
        route: "quran/1",
        section: "quran",
        title: "Al-Fatihah",
      }),
    }));

    const results = await Promise.all([
      target.query((ctx) =>
        runConvexProgram(
          loadContentTarget(ctx, {
            contentId: routes.curriculum,
            locale: "id",
            publicPath: "material/lesson/mathematics/vector",
            section: "material",
          })
        )
      ),
      target.query((ctx) =>
        runConvexProgram(
          loadContentTarget(ctx, {
            contentId: routes.quran,
            locale: "id",
            publicPath: "quran/1",
            section: "quran",
          })
        )
      ),
    ]);

    expect(results).toEqual([null, null]);
  });

  it("rejects a route whose graph identity no longer matches its asset", async () => {
    const target = convexTest(schema, convexModules);
    const staleContentId = `${ARTICLE_VIEW_ID}:stale`;

    await target.mutation(async (ctx) => {
      await insertContentViewArticle(ctx);
      const route = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (query) =>
          query.eq("content_id", ARTICLE_VIEW_ID)
        )
        .unique();

      if (!route) {
        throw new Error("Expected article route fixture.");
      }

      await ctx.db.patch(route._id, { content_id: staleContentId });
    });

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          loadContentTarget(ctx, {
            contentId: staleContentId,
            locale: "id",
            publicPath: ARTICLE_VIEW_ROUTE,
            section: "articles",
          })
        )
      )
    ).resolves.toBeNull();
  });

  it("resolves subject and try-out graph identities from source routes", async () => {
    const target = convexTest(schema, convexModules);
    const fixtures = await target.mutation(async (ctx) => ({
      subject: await insertContentViewSubject(ctx),
      tryout: await insertContentViewTryout(ctx),
    }));

    const results = await Promise.all([
      target.query((ctx) =>
        runConvexProgram(
          loadContentTarget(ctx, {
            contentId: fixtures.subject.contentId,
            locale: "id",
            publicPath: SUBJECT_VIEW_ROUTE,
            section: "material",
          })
        )
      ),
      target.query((ctx) =>
        runConvexProgram(
          loadContentTarget(ctx, {
            contentId: fixtures.tryout.contentId,
            locale: "id",
            publicPath: TRYOUT_VIEW_ROUTE,
            section: "tryout",
          })
        )
      ),
    ]);

    expect(results).toMatchObject([
      {
        content_id: fixtures.subject.contentId,
        route: SUBJECT_VIEW_ROUTE,
      },
      {
        content_id: fixtures.tryout.contentId,
        route: TRYOUT_VIEW_ROUTE,
      },
    ]);
  });
});
