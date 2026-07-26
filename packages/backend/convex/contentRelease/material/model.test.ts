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
  it("returns an unmanaged model before material publication", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) =>
        runConvexProgram(readMaterialModel(ctx, "en", "subjects/test/missing"))
      )
    ).resolves.toMatchObject({
      alternateJson: [],
      managed: false,
      projectionJson: null,
      rendererDomain: null,
      siblingJson: [],
    });
  });

  it("returns the exact route, locale counterparts, and ordered siblings", async () => {
    const t = convexTest(schema, convexModules);
    const requested = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(t);

    const result = await t.query((ctx) =>
      runConvexProgram(
        readMaterialModel(ctx, requested.locale, requested.publicPath)
      )
    );

    expect(result).toMatchObject({
      activeManifestHash: expect.any(String),
      activeReleaseId: expect.any(String),
      managed: true,
      rendererDomain: "mathematics",
      sourceRevision: "a".repeat(40),
    });
    expect(decodeProjection(result.projectionJson ?? "")).toEqual(requested);
    expect(result.alternateJson.map(decodeProjection)).toMatchObject([
      { locale: "en", order: 1 },
      { locale: "id", order: 1 },
    ]);
    expect(result.siblingJson.map(decodeProjection)).toMatchObject([
      { locale: "en", order: 1 },
      { locale: "en", order: 2 },
    ]);
  });

  it("distinguishes an owned missing route from an unmanaged source", async () => {
    const t = convexTest(schema, convexModules);
    await activateMaterialCatalog(t);

    await expect(
      t.query((ctx) =>
        runConvexProgram(readMaterialModel(ctx, "en", "subjects/test/missing"))
      )
    ).resolves.toMatchObject({
      managed: true,
      projectionJson: null,
      sourceRevision: "a".repeat(40),
    });
  });

  it("rejects a material whose locale counterpart is missing", async () => {
    const t = convexTest(schema, convexModules);
    const projection = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(t, [projection]);

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readMaterialModel(ctx, projection.locale, projection.publicPath)
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects non-material and tampered catalog projections", async () => {
    const t = convexTest(schema, convexModules);
    const requested = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(t);
    await t.mutation(async (ctx) => {
      const row = await ctx.db
        .query("materialCatalog")
        .withIndex("by_locale_and_publicPath", (index) =>
          index
            .eq("locale", requested.locale)
            .eq("publicPath", requested.publicPath)
        )
        .unique();
      if (!row) {
        throw new Error("Expected one technical material row.");
      }
      await ctx.db.patch("materialCatalog", row._id, {
        projectionJson: TEST_ARTICLE_PROJECTION_JSON,
      });
    });

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readMaterialModel(ctx, requested.locale, requested.publicPath)
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    await t.mutation(async (ctx) => {
      const row = await ctx.db
        .query("materialCatalog")
        .withIndex("by_locale_and_publicPath", (index) =>
          index
            .eq("locale", requested.locale)
            .eq("publicPath", requested.publicPath)
        )
        .unique();
      if (!row) {
        throw new Error("Expected one technical material row.");
      }
      await ctx.db.patch("materialCatalog", row._id, {
        projectionHash: "tampered",
        projectionJson: canonicalizeMaterialProjection(requested),
      });
    });
    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readMaterialModel(ctx, requested.locale, requested.publicPath)
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects siblings that claim different parents for one material key", async () => {
    const t = convexTest(schema, convexModules);
    const requested = makeMaterialProjection("en", 1);
    const other = makeMaterialProjection("en", 2);
    const conflicting = Schema.decodeUnknownSync(
      MaterialLessonProjectionSchema
    )({
      ...other,
      parentPath: "subjects/test/other-topic",
      publicPath: "subjects/test/other-topic/section-2",
    });
    await activateMaterialCatalog(t, [
      requested,
      conflicting,
      makeMaterialProjection("id", 1),
      makeMaterialProjection("id", 2),
    ]);

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readMaterialModel(ctx, requested.locale, requested.publicPath)
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects a material group beyond the bounded read contract", async () => {
    const t = convexTest(schema, convexModules);
    const requested = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(t);
    await t.mutation(async (ctx) => {
      for (let order = 3; order <= 101; order += 1) {
        const projection = makeMaterialProjection("en", order);
        await ctx.db.insert("materialCatalog", {
          contentKey: projection.contentKey,
          locale: projection.locale,
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
        });
      }
    });

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readMaterialModel(ctx, requested.locale, requested.publicPath)
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });
});
