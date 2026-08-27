import {
  canonicalizeMaterialProjection,
  MaterialLessonProjectionSchema,
} from "@nakafa/aksara-contracts/projection/material";
import { readMaterialModel } from "@repo/backend/convex/contentRelease/material/model";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import { TEST_ARTICLE_PROJECTION_JSON } from "@repo/backend/test/content-runtime";
import { activateMaterialCatalog } from "@repo/backend/test/material-catalog";
import { normalizePublicationDates } from "@repo/contents/_types/publication";
import { convexTest } from "convex-test";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

/** Decodes one returned material projection for result assertions. */
function decodeProjection(source: string) {
  return Schema.decodeUnknownSync(MaterialLessonProjectionSchema)(
    JSON.parse(source)
  );
}

describe("contentRelease/material/model", () => {
  it("fails closed before signed material publication", async () => {
    const target = convexTest(schema, convexModules);

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readMaterialModel(ctx, "en", "subjects/test/missing", "publication")
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_MISSING" },
    });
  });

  it("returns the route, locale counterparts, and ordered siblings", async () => {
    const target = convexTest(schema, convexModules);
    const requested = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target);

    const result = await target.query((ctx) =>
      runConvexProgram(
        readMaterialModel(
          ctx,
          requested.appLocale,
          requested.publicPath,
          "publication"
        )
      )
    );

    expect(result).toMatchObject({
      activeManifestHash: expect.any(String),
      activeReleaseId: expect.any(String),
      rendererDomain: "mathematics",
      sourceRevision: "a".repeat(40),
    });
    expect(decodeProjection(result.projectionJson ?? "")).toEqual(requested);
    expect(result.alternateJson.map(decodeProjection)).toMatchObject([
      { appLocale: "en", order: 1 },
      { appLocale: "id", order: 1 },
      { appLocale: "de", order: 1 },
    ]);
    expect(result.siblingJson.map(decodeProjection)).toMatchObject([
      { appLocale: "en", order: 1 },
      { appLocale: "en", order: 2 },
    ]);
  });

  it.each([
    ["locale counterpart", makeMaterialProjection("id", 1)],
    ["sibling", makeMaterialProjection("en", 2)],
  ])("rejects a stale %s row", async (_label, stale) => {
    const target = convexTest(schema, convexModules);
    const requested = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target);
    await target.mutation(async (ctx) => {
      const row = await ctx.db
        .query("materialCatalog")
        .withIndex("by_appLocale_and_publicPath", (index) =>
          index
            .eq("appLocale", stale.appLocale)
            .eq("publicPath", stale.publicPath)
        )
        .unique();
      if (!row) {
        throw new Error("Expected one related material row.");
      }
      await ctx.db.patch("materialCatalog", row._id, {
        releaseId: "stale-release",
        sequence: 0,
      });
    });

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readMaterialModel(
            ctx,
            requested.appLocale,
            requested.publicPath,
            "publication"
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("returns a missing route inside the current signed family", async () => {
    const target = convexTest(schema, convexModules);
    await activateMaterialCatalog(target);

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readMaterialModel(ctx, "en", "subjects/test/missing", "publication")
        )
      )
    ).resolves.toMatchObject({
      projectionJson: null,
      sourceRevision: "a".repeat(40),
    });
  });

  it("rejects a material whose locale counterpart is missing", async () => {
    const target = convexTest(schema, convexModules);
    const projection = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target, [projection]);

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readMaterialModel(
            ctx,
            projection.appLocale,
            projection.publicPath,
            "publication"
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects non-material and mismatched catalog projections", async () => {
    const target = convexTest(schema, convexModules);
    const requested = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target);
    await target.mutation(async (ctx) => {
      const row = await ctx.db
        .query("materialCatalog")
        .withIndex("by_appLocale_and_publicPath", (index) =>
          index
            .eq("appLocale", requested.appLocale)
            .eq("publicPath", requested.publicPath)
        )
        .unique();
      if (!row) {
        throw new Error("Expected one current material row.");
      }
      await ctx.db.patch("materialCatalog", row._id, {
        projectionJson: TEST_ARTICLE_PROJECTION_JSON,
      });
    });

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readMaterialModel(
            ctx,
            requested.appLocale,
            requested.publicPath,
            "publication"
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    await target.mutation(async (ctx) => {
      const row = await ctx.db
        .query("materialCatalog")
        .withIndex("by_appLocale_and_publicPath", (index) =>
          index
            .eq("appLocale", requested.appLocale)
            .eq("publicPath", requested.publicPath)
        )
        .unique();
      if (!row) {
        throw new Error("Expected one current material row.");
      }
      await ctx.db.patch("materialCatalog", row._id, {
        projectionJson: canonicalizeMaterialProjection(requested),
        sourcePath: "packages/corpus/material/lesson/test/other/en.mdx",
      });
    });
    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readMaterialModel(
            ctx,
            requested.appLocale,
            requested.publicPath,
            "publication"
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects siblings that claim different parents for one material key", async () => {
    const target = convexTest(schema, convexModules);
    const requested = makeMaterialProjection("en", 1);
    const other = makeMaterialProjection("en", 2);
    const conflicting = Schema.decodeSync(MaterialLessonProjectionSchema)({
      ...other,
      parentPath: "subjects/test/other-topic",
      publicPath: "subjects/test/other-topic/section-2",
    });
    await activateMaterialCatalog(target, [
      requested,
      conflicting,
      makeMaterialProjection("id", 1),
      makeMaterialProjection("id", 2),
    ]);

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readMaterialModel(
            ctx,
            requested.appLocale,
            requested.publicPath,
            "publication"
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects a material group beyond the bounded read contract", async () => {
    const target = convexTest(schema, convexModules);
    const requested = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target);
    await target.mutation(async (ctx) => {
      for (let order = 3; order <= 101; order += 1) {
        const projection = makeMaterialProjection("en", order);
        const dates = normalizePublicationDates(projection.metadata);
        await ctx.db.insert("materialCatalog", {
          assetId: projection.graph.assetId,
          bucket: "abc",
          contentKey: projection.contentKey,
          date: dates.datePublished,
          appLocale: projection.appLocale,
          materialKey: projection.materialKey,
          order: projection.order,
          parentPath: projection.parentPath,
          projectionHash: "not-read",
          projectionJson: "{}",
          publicPath: projection.publicPath,
          releaseId: "not-read",
          rendererDomain: "mathematics",
          sequence: 1,
          sourcePath: "not-read",
          topicAssetId: projection.graph.assetId,
        });
      }
    });

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readMaterialModel(
            ctx,
            requested.appLocale,
            requested.publicPath,
            "publication"
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });
});
