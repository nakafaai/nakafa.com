import { describe, expect, it } from "@effect/vitest";
import {
  ContentKeySchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  MaterialKeySchema,
  MaterialLessonProjectionSchema,
} from "@nakafa/aksara-contracts/projection/material";
import {
  type DurableContentViewTargetInput,
  decodeMaterialDomain,
  hydrateDurableContentTarget,
  type IncomingContentViewTargetInput,
  validateIncomingContentTarget,
} from "@repo/backend/convex/contents/views/target";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  FUNCTION_MATERIAL,
  makeMaterialProjection,
  testMaterialGraph,
} from "@repo/backend/test/content/material";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content/runtime";
import { activateMaterialCatalog } from "@repo/backend/test/material/catalog";
import { insertRuntimeBinding } from "@repo/backend/test/runtime/head";
import { convexTest, type TestConvex } from "convex-test";
import { Effect } from "effect";

/** Runs one incoming-route validation through the production Effect boundary. */
function validateIncomingTarget(
  target: TestConvex<typeof schema>,
  input: IncomingContentViewTargetInput
) {
  return target.query((ctx) =>
    runConvexProgram(validateIncomingContentTarget(ctx, input))
  );
}

/** Runs one durable-identity hydration through the production Effect boundary. */
function hydrateDurableTarget(
  target: TestConvex<typeof schema>,
  input: DurableContentViewTargetInput
) {
  return target.query((ctx) =>
    runConvexProgram(hydrateDurableContentTarget(ctx, input))
  );
}

describe("contents/views/target", () => {
  it.live(
    "fails with the typed view error for an invalid material domain",
    () =>
      Effect.gen(function* () {
        expect(
          yield* Effect.flip(
            decodeMaterialDomain("lesson.Invalid.technical-topic")
          )
        ).toMatchObject({
          _tag: "ContentViewIoError",
          code: "CONTENT_VIEW_IO_FAILED",
        });
      })
  );

  it("fails closed before current signed ownership is available", async () => {
    const target = convexTest(schema, convexModules);

    await expect(
      validateIncomingTarget(target, {
        contentId: "asset:en:article:politics:missing",
        locale: "en",
        publicPath: "articles/politics/missing",
        section: "articles",
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_VIEW_IO_FAILED" },
    });
    await expect(
      validateIncomingTarget(target, {
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
    const result = await validateIncomingTarget(target, {
      contentId: FUNCTION_MATERIAL.graph.assetId,
      locale: "en",
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
      validateIncomingTarget(target, {
        contentId: `${FUNCTION_MATERIAL.graph.assetId}:stale`,
        locale: "en",
        publicPath: FUNCTION_MATERIAL.publicPath,
        section: "material",
      })
    ).resolves.toBeNull();
    await expect(
      validateIncomingTarget(target, {
        contentId: FUNCTION_MATERIAL.graph.assetId,
        locale: "en",
        publicPath: `${FUNCTION_MATERIAL.parentPath}/missing`,
        section: "material",
      })
    ).resolves.toBeNull();
  });

  it("hydrates a renamed material by asset ID while rejecting its stale incoming route", async () => {
    const target = convexTest(schema, convexModules);
    const current = MaterialLessonProjectionSchema.make({
      ...FUNCTION_MATERIAL,
      parentPath: PublicPathSchema.make(
        "subjects/mathematics/functions-and-relations"
      ),
      publicPath: PublicPathSchema.make(
        "subjects/mathematics/functions-and-relations/function-concept"
      ),
    });
    await activateMaterialCatalog(target, [current]);

    await expect(
      hydrateDurableTarget(target, {
        contentId: FUNCTION_MATERIAL.graph.assetId,
        locale: "en",
        section: "material",
      })
    ).resolves.toMatchObject({
      content_id: FUNCTION_MATERIAL.graph.assetId,
      route: current.publicPath,
      sourcePath: expect.stringContaining(FUNCTION_MATERIAL.contentKey),
    });
    await expect(
      validateIncomingTarget(target, {
        contentId: FUNCTION_MATERIAL.graph.assetId,
        locale: "en",
        publicPath: FUNCTION_MATERIAL.publicPath,
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
      validateIncomingTarget(target, {
        contentId: projection.graph.assetId,
        locale: "en",
        publicPath: projection.publicPath,
        section: "articles",
      })
    ).resolves.toMatchObject({
      contentKey: projection.contentKey,
      content_id: projection.graph.assetId,
      route: projection.publicPath,
      section: "articles",
      sourcePath: `packages/corpus/${projection.contentKey}/${projection.artifactLocale}.mdx`,
      title: projection.metadata.title,
    });
    await expect(
      hydrateDurableTarget(target, {
        contentId: projection.graph.assetId,
        locale: "en",
        section: "articles",
      })
    ).resolves.toMatchObject({
      contentKey: projection.contentKey,
      content_id: projection.graph.assetId,
      route: projection.publicPath,
      section: "articles",
    });
  });

  it("returns null for missing or mismatched current article bindings", async () => {
    const target = convexTest(schema, convexModules);
    const projection = testArticleProjection(0);
    await target.mutation((ctx) =>
      insertRuntimeArticles(ctx, 1, () => projection)
    );

    await expect(
      validateIncomingTarget(target, {
        contentId: `${projection.graph.assetId}:stale`,
        locale: "en",
        publicPath: projection.publicPath,
        section: "articles",
      })
    ).resolves.toBeNull();
    await expect(
      validateIncomingTarget(target, {
        contentId: projection.graph.assetId,
        locale: "en",
        publicPath: `${projection.parentPath}/missing`,
        section: "articles",
      })
    ).resolves.toBeNull();

    const aliasPath = PublicPathSchema.make("articles/politics/legacy-alias");
    await target.mutation((ctx) =>
      insertRuntimeBinding(ctx, projection.contentKey, {
        appLocale: projection.appLocale,
        publicPath: aliasPath,
      })
    );
    await expect(
      validateIncomingTarget(target, {
        contentId: projection.graph.assetId,
        locale: "en",
        publicPath: aliasPath,
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
      validateIncomingTarget(target, {
        contentId: projection.graph.assetId,
        locale: "en",
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
