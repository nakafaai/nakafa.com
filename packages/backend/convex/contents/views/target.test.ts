import {
  ContentKeySchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import { ArticleProjectionSchema } from "@nakafa/aksara-contracts/projection/article";
import {
  MaterialKeySchema,
  MaterialLessonProjectionSchema,
} from "@nakafa/aksara-contracts/projection/material";
import {
  type ContentViewTargetInput,
  loadContentTarget,
} from "@repo/backend/convex/contents/views/target";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  FUNCTION_MATERIAL,
  makeMaterialProjection,
  testMaterialGraph,
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
  insertContentViewSourceTargets,
} from "@repo/backend/test/content-view";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
  selectExactMaterial,
} from "@repo/backend/test/material-catalog";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, it } from "vitest";

const SOURCE_PATH = "articles/politics/source-target";
const PUBLISHED_MATERIAL = FUNCTION_MATERIAL;
const RENAMED_MATERIAL = MaterialLessonProjectionSchema.make({
  ...PUBLISHED_MATERIAL,
  publicPath: PublicPathSchema.make(
    `${PUBLISHED_MATERIAL.parentPath}/function-concept-renamed`
  ),
});
/** Inserts one route-catalog target whose family remains source-owned. */
async function insertSourceTarget(target: TestConvex<typeof schema>) {
  const contentId = "asset:en:article:politics:source-target";
  return await target.mutation((ctx) =>
    insertContentViewRoute(ctx, {
      contentId,
      kind: "article",
      locale: "en",
      route: SOURCE_PATH,
      section: "articles",
      sourcePath: `packages/contents/${SOURCE_PATH}/en.mdx`,
      title: "Source target",
    })
  );
}

/** Inserts the source route retained during the material expand phase. */
async function insertLegacyMaterialTarget(target: TestConvex<typeof schema>) {
  await target.mutation((ctx) =>
    insertContentViewRoute(ctx, {
      contentId: PUBLISHED_MATERIAL.graph.assetId,
      graph: PUBLISHED_MATERIAL.graph,
      kind: "curriculum-lesson",
      locale: PUBLISHED_MATERIAL.locale,
      materialDomain: "mathematics",
      route: PUBLISHED_MATERIAL.publicPath,
      section: "material",
      sourcePath: PUBLISHED_MATERIAL.contentKey,
      title: PUBLISHED_MATERIAL.metadata.title,
    })
  );
}

/** Inserts one active article together with its expand-phase source route. */
async function insertLegacyArticleTarget(target: TestConvex<typeof schema>) {
  const projection = testArticleProjection(0);
  await target.mutation(async (ctx) => {
    await insertContentViewRoute(ctx, {
      contentId: projection.graph.assetId,
      graph: projection.graph,
      kind: "article",
      locale: projection.locale,
      route: projection.publicPath,
      section: "articles",
      sourcePath: projection.contentKey,
      title: projection.metadata.title,
    });
    await insertRuntimeArticles(ctx, 1, () => projection);
  });
  return projection;
}

/** Runs one target lookup through the production Effect boundary. */
function readTarget(
  target: TestConvex<typeof schema>,
  input: ContentViewTargetInput
) {
  return target.query((ctx) => runConvexProgram(loadContentTarget(ctx, input)));
}

describe("contents/views/target", () => {
  it("returns best-effort misses for unknown or incomplete routes", async () => {
    const target = convexTest(schema, convexModules);
    const contentId = await insertSourceTarget(target);
    const results = await Promise.all([
      readTarget(target, {
        contentId: "asset:id:missing",
        locale: "id",
        publicPath: "articles/politics/missing",
        section: "articles",
      }),
      readTarget(target, {
        contentId,
        locale: "en",
        publicPath: SOURCE_PATH,
      }),
    ]);

    expect(results).toEqual([null, null]);
  });

  it("resolves an unmanaged route by current path and stable content id", async () => {
    const target = convexTest(schema, convexModules);
    const contentId = await insertSourceTarget(target);
    const results = await Promise.all([
      readTarget(target, {
        contentId,
        locale: "en",
        publicPath: SOURCE_PATH,
        section: "articles",
      }),
      readTarget(target, {
        contentId,
        locale: "en",
      }),
    ]);

    expect(results).toMatchObject([
      {
        content_id: contentId,
        route: SOURCE_PATH,
        section: "articles",
        sourcePath: `packages/contents/${SOURCE_PATH}/en.mdx`,
      },
      {
        content_id: contentId,
        route: SOURCE_PATH,
        section: "articles",
      },
    ]);
  });

  it("resolves active materials by current path and stable asset identity", async () => {
    const target = convexTest(schema, convexModules);
    await activateMaterialCatalog(target, [PUBLISHED_MATERIAL]);
    const input: ContentViewTargetInput = {
      contentId: PUBLISHED_MATERIAL.graph.assetId,
      locale: PUBLISHED_MATERIAL.locale,
      section: "material",
    };
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

  it("resolves exact-owned materials without a family-wide cutover", async () => {
    const target = convexTest(schema, convexModules);
    await activateMaterialCatalog(target, [PUBLISHED_MATERIAL]);
    await selectExactMaterial(target, PUBLISHED_MATERIAL);
    const input: ContentViewTargetInput = {
      contentId: PUBLISHED_MATERIAL.graph.assetId,
      locale: PUBLISHED_MATERIAL.locale,
      section: "material",
    };
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
      contentKey: PUBLISHED_MATERIAL.contentKey,
      content_id: PUBLISHED_MATERIAL.graph.assetId,
      route: PUBLISHED_MATERIAL.publicPath,
    });
    expect(byIdentity).toEqual(byPath);
  });

  it("does not revive an exact-owned material tombstone by asset identity", async () => {
    const target = convexTest(schema, convexModules);
    await insertLegacyMaterialTarget(target);
    await activateMaterialCatalog(target, [PUBLISHED_MATERIAL]);
    await selectExactMaterial(target, PUBLISHED_MATERIAL);
    await target.mutation(async (ctx) => {
      const binding = await ctx.db
        .query("contentBindings")
        .withIndex("by_locale_and_publicPath_and_sequence_and_index", (index) =>
          index
            .eq("locale", PUBLISHED_MATERIAL.locale)
            .eq("publicPath", PUBLISHED_MATERIAL.publicPath)
            .eq("sequence", MATERIAL_IDENTITY.sequence)
        )
        .unique();
      const material = await ctx.db
        .query("materialCatalog")
        .withIndex("by_contentKey_and_locale", (index) =>
          index
            .eq("contentKey", PUBLISHED_MATERIAL.contentKey)
            .eq("locale", PUBLISHED_MATERIAL.locale)
        )
        .unique();
      if (!(binding && material)) {
        throw new Error("Expected active material fixture rows.");
      }
      await ctx.db.delete("contentBindings", binding._id);
      await ctx.db.delete("materialCatalog", material._id);
    });
    const inputs: readonly ContentViewTargetInput[] = [
      {
        contentId: PUBLISHED_MATERIAL.graph.assetId,
        locale: PUBLISHED_MATERIAL.locale,
        section: "material",
      },
      {
        contentId: PUBLISHED_MATERIAL.graph.assetId,
        locale: PUBLISHED_MATERIAL.locale,
        publicPath: PUBLISHED_MATERIAL.publicPath,
        section: "material",
      },
    ];
    await expect(
      Promise.all(
        inputs.map((input) =>
          target.query((ctx) => runConvexProgram(loadContentTarget(ctx, input)))
        )
      )
    ).resolves.toEqual([null, null]);
  });

  it("resolves a legacy material view to its renamed active route", async () => {
    const target = convexTest(schema, convexModules);
    await insertLegacyMaterialTarget(target);
    await activateMaterialCatalog(target, [RENAMED_MATERIAL]);
    await expect(
      target.query((ctx) =>
        runConvexProgram(
          loadContentTarget(ctx, {
            contentId: PUBLISHED_MATERIAL.graph.assetId,
            locale: PUBLISHED_MATERIAL.locale,
          })
        )
      )
    ).resolves.toMatchObject({
      contentKey: PUBLISHED_MATERIAL.contentKey,
      content_id: PUBLISHED_MATERIAL.graph.assetId,
      route: RENAMED_MATERIAL.publicPath,
    });
  });

  it("does not revive stale material routes after ownership activates", async () => {
    const target = convexTest(schema, convexModules);
    const contentId = await insertSourceTarget(target);
    await activateMaterialCatalog(target, [PUBLISHED_MATERIAL]);
    await expect(
      target.query((ctx) =>
        runConvexProgram(
          loadContentTarget(ctx, {
            contentId,
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
    const projection = ArticleProjectionSchema.make({
      ...testArticleProjection(0),
      publicPath: PublicPathSchema.make("articles/politics/published-article"),
    });
    const routeIdentity = createLearningGraphIdentityFromRoute({
      locale: projection.locale,
      route: projection.publicPath,
    });
    if (!routeIdentity) {
      throw new Error("Expected one path-derived article graph identity.");
    }
    expect(routeIdentity.assetId).not.toBe(projection.graph.assetId);
    await target.mutation((ctx) =>
      insertRuntimeArticles(ctx, 1, () => projection)
    );
    await expect(
      target.query((ctx) =>
        runConvexProgram(
          loadContentTarget(ctx, {
            contentId: routeIdentity.assetId,
            locale: projection.locale,
            publicPath: projection.publicPath,
            section: "articles",
          })
        )
      )
    ).resolves.toMatchObject({
      content_id: projection.graph.assetId,
      route: projection.publicPath,
      sourcePath: `packages/corpus/${projection.contentKey}/${projection.locale}.mdx`,
      title: projection.metadata.title,
    });
  });

  it("resolves a legacy article view through its stable source identity", async () => {
    const target = convexTest(schema, convexModules);
    const projection = await insertLegacyArticleTarget(target);
    await expect(
      target.query((ctx) =>
        runConvexProgram(
          loadContentTarget(ctx, {
            contentId: projection.graph.assetId,
            locale: projection.locale,
          })
        )
      )
    ).resolves.toMatchObject({
      contentKey: projection.contentKey,
      content_id: projection.graph.assetId,
      route: projection.publicPath,
    });
  });

  it("rejects active material taxonomy outside the application registry", async () => {
    const target = convexTest(schema, convexModules);
    const registered = makeMaterialProjection("en", 1);
    const projection = MaterialLessonProjectionSchema.make({
      ...registered,
      contentKey: ContentKeySchema.make(
        "material/lesson/test/technical-topic/section-1"
      ),
      graph: testMaterialGraph("technical-topic", "section-1"),
      materialKey: MaterialKeySchema.make("lesson.test.technical-topic"),
      parentPath: PublicPathSchema.make("subjects/test/technical-topic"),
      publicPath: PublicPathSchema.make(
        "subjects/test/technical-topic/section-1"
      ),
    });
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
    const cases = await target.mutation(insertContentViewSourceTargets);
    const results = await Promise.all(
      cases.map(({ input }) =>
        target.query((ctx) => runConvexProgram(loadContentTarget(ctx, input)))
      )
    );

    expect(results).toMatchObject(
      cases.map(({ expectedRoute, input }) => ({
        content_id: input.contentId,
        route: expectedRoute,
      }))
    );
  });
});
