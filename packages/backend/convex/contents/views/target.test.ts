import {
  ContentKeySchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  MaterialKeySchema,
  MaterialLessonProjectionSchema,
} from "@nakafa/aksara-contracts/projection/material";
import {
  type ContentViewTargetInput,
  decodeMaterialDomain,
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
import { activateMaterialCatalog } from "@repo/backend/test/material-catalog";
import { convexTest, type TestConvex } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

/** Runs one target lookup through the production Effect boundary. */
function readTarget(
  target: TestConvex<typeof schema>,
  input: ContentViewTargetInput
) {
  return target.query((ctx) => runConvexProgram(loadContentTarget(ctx, input)));
}

describe("contents/views/target", () => {
  it("fails with the typed view error for an invalid material domain", async () => {
    await expect(
      Effect.runPromise(
        Effect.flip(decodeMaterialDomain("lesson.Invalid.technical-topic"))
      )
    ).resolves.toMatchObject({
      _tag: "ContentViewIoError",
      code: "CONTENT_VIEW_IO_FAILED",
    });
  });

  it("fails closed before current signed ownership is available", async () => {
    const target = convexTest(schema, convexModules);

    await expect(
      readTarget(target, {
        contentId: "asset:en:article:politics:missing",
        locale: "en",
        publicPath: "articles/politics/missing",
        section: "articles",
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_VIEW_IO_FAILED" },
    });
    await expect(
      readTarget(target, {
        contentId: "asset:en:material:mathematics:missing",
        locale: "en",
        publicPath: "subjects/mathematics/missing",
        section: "material",
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_VIEW_IO_FAILED" },
    });
  });

  it("resolves active materials by signed path and stable asset identity", async () => {
    const target = convexTest(schema, convexModules);
    await activateMaterialCatalog(target, [FUNCTION_MATERIAL]);
    const result = await readTarget(target, {
      contentId: FUNCTION_MATERIAL.graph.assetId,
      locale: FUNCTION_MATERIAL.locale,
      publicPath: FUNCTION_MATERIAL.publicPath,
      section: "material",
    });

    expect(result).toMatchObject({
      contentKey: FUNCTION_MATERIAL.contentKey,
      content_id: FUNCTION_MATERIAL.graph.assetId,
      materialDomain: "mathematics",
      materialKey: FUNCTION_MATERIAL.materialKey,
      route: FUNCTION_MATERIAL.publicPath,
      section: "material",
      sourcePath: expect.stringContaining(FUNCTION_MATERIAL.contentKey),
    });
  });

  it("returns null for missing or mismatched current material bindings", async () => {
    const target = convexTest(schema, convexModules);
    await activateMaterialCatalog(target, [FUNCTION_MATERIAL]);

    await expect(
      readTarget(target, {
        contentId: `${FUNCTION_MATERIAL.graph.assetId}:stale`,
        locale: FUNCTION_MATERIAL.locale,
        publicPath: FUNCTION_MATERIAL.publicPath,
        section: "material",
      })
    ).resolves.toBeNull();
    await expect(
      readTarget(target, {
        contentId: FUNCTION_MATERIAL.graph.assetId,
        locale: FUNCTION_MATERIAL.locale,
        publicPath: `${FUNCTION_MATERIAL.parentPath}/missing`,
        section: "material",
      })
    ).resolves.toBeNull();
  });

  it("resolves active articles without legacy route rows", async () => {
    const target = convexTest(schema, convexModules);
    const projection = testArticleProjection(0);
    await target.mutation((ctx) =>
      insertRuntimeArticles(ctx, 1, () => projection)
    );

    await expect(
      readTarget(target, {
        contentId: projection.graph.assetId,
        locale: projection.locale,
        publicPath: projection.publicPath,
        section: "articles",
      })
    ).resolves.toMatchObject({
      contentKey: projection.contentKey,
      content_id: projection.graph.assetId,
      route: projection.publicPath,
      section: "articles",
      sourcePath: `packages/corpus/${projection.contentKey}/${projection.locale}.mdx`,
      title: projection.metadata.title,
    });
  });

  it("returns null for missing or mismatched current article bindings", async () => {
    const target = convexTest(schema, convexModules);
    const projection = testArticleProjection(0);
    await target.mutation((ctx) =>
      insertRuntimeArticles(ctx, 1, () => projection)
    );

    await expect(
      readTarget(target, {
        contentId: `${projection.graph.assetId}:stale`,
        locale: projection.locale,
        publicPath: projection.publicPath,
        section: "articles",
      })
    ).resolves.toBeNull();
    await expect(
      readTarget(target, {
        contentId: projection.graph.assetId,
        locale: projection.locale,
        publicPath: `${projection.parentPath}/missing`,
        section: "articles",
      })
    ).resolves.toBeNull();
  });

  it("accepts a signed Aksara domain outside the presentation registry", async () => {
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
      readTarget(target, {
        contentId: projection.graph.assetId,
        locale: projection.locale,
        publicPath: projection.publicPath,
        section: "material",
      })
    ).resolves.toMatchObject({
      contentKey: projection.contentKey,
      content_id: projection.graph.assetId,
      materialDomain: "test",
      materialKey: projection.materialKey,
      route: projection.publicPath,
      section: "material",
    });
  });
});
