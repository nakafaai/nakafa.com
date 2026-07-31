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
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
  selectExactMaterial,
} from "@repo/backend/test/material-catalog";
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
      familyManaged: false,
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
      familyManaged: true,
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

  it("uses exact ownership and preserves an owned tombstone", async () => {
    const t = convexTest(schema, convexModules);
    const requested = makeMaterialProjection("en", 1);
    const unowned = makeMaterialProjection("en", 2);
    const sourceCandidates = [
      { contentKey: requested.contentKey, locale: requested.locale },
      { contentKey: unowned.contentKey, locale: unowned.locale },
    ];
    await activateMaterialCatalog(t);
    await selectExactMaterial(t, requested);

    const exact = await t.query((ctx) =>
      runConvexProgram(
        readMaterialModel(
          ctx,
          requested.locale,
          requested.publicPath,
          sourceCandidates
        )
      )
    );
    expect(exact).toMatchObject({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
      familyManaged: false,
      managed: true,
      rendererDomain: "mathematics",
      sourceRevision: "a".repeat(40),
    });
    expect(exact.alternateJson.map(decodeProjection)).toEqual([requested]);
    expect(exact.siblingJson.map(decodeProjection)).toEqual([requested]);
    expect(exact.sourceClaims).toEqual([
      {
        contentKey: requested.contentKey,
        kind: "found",
        locale: requested.locale,
        projectionJson: canonicalizeMaterialProjection(requested),
      },
    ]);
    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readMaterialModel(ctx, unowned.locale, unowned.publicPath)
        )
      )
    ).resolves.toMatchObject({ managed: false, projectionJson: null });

    await t.mutation(async (ctx) => {
      const binding = await ctx.db
        .query("contentBindings")
        .withIndex("by_locale_and_publicPath_and_sequence_and_index", (index) =>
          index
            .eq("locale", requested.locale)
            .eq("publicPath", requested.publicPath)
            .eq("sequence", MATERIAL_IDENTITY.sequence)
        )
        .unique();
      if (!binding) {
        throw new Error("Expected one active material route binding.");
      }
      await ctx.db.patch("contentBindings", binding._id, {
        operation: "delete",
      });
      const head = await ctx.db
        .query("contentHeads")
        .withIndex("by_contentKey_and_locale_and_sequence", (index) =>
          index
            .eq("contentKey", requested.contentKey)
            .eq("locale", requested.locale)
            .eq("sequence", MATERIAL_IDENTITY.sequence)
        )
        .unique();
      if (!head) {
        throw new Error("Expected one active material content version.");
      }
      await ctx.db.patch("contentHeads", head._id, { operation: "delete" });
    });

    const deleted = await t.query((ctx) =>
      runConvexProgram(
        readMaterialModel(
          ctx,
          requested.locale,
          requested.publicPath,
          sourceCandidates
        )
      )
    );
    expect(deleted).toMatchObject({
      managed: true,
      projectionJson: null,
      sourcePath: null,
      sourceRevision: "a".repeat(40),
    });
    expect(deleted.sourceClaims).toEqual([
      {
        contentKey: requested.contentKey,
        kind: "missing",
        locale: requested.locale,
      },
    ]);
  });

  it("scopes one moved exact lesson to its active parent", async () => {
    const t = convexTest(schema, convexModules);
    const source = makeMaterialProjection("en", 1);
    const sourceSibling = makeMaterialProjection("en", 2);
    const moved = Schema.decodeUnknownSync(MaterialLessonProjectionSchema)({
      ...source,
      parentPath: "subjects/test/moved-topic",
      publicPath: "subjects/test/moved-topic/section-1",
    });
    await activateMaterialCatalog(t, [moved, sourceSibling]);
    await selectExactMaterial(t, moved);

    const result = await t.query((ctx) =>
      runConvexProgram(readMaterialModel(ctx, moved.locale, moved.publicPath))
    );

    expect(decodeProjection(result.projectionJson ?? "")).toEqual(moved);
    expect(result.siblingJson.map(decodeProjection)).toEqual([moved]);
  });

  it("supports one exact material locale without claiming family parity", async () => {
    const t = convexTest(schema, convexModules);
    const projection = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(t, [projection]);
    await selectExactMaterial(t, projection);

    const result = await t.query((ctx) =>
      runConvexProgram(
        readMaterialModel(ctx, projection.locale, projection.publicPath)
      )
    );

    expect(result).toMatchObject({
      familyManaged: false,
      managed: true,
    });
    expect(result.alternateJson.map(decodeProjection)).toEqual([projection]);
    expect(result.siblingJson.map(decodeProjection)).toEqual([projection]);
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

    const missing = convexTest(schema, convexModules);
    await activateMaterialCatalog(missing);
    await missing.mutation(async (ctx) => {
      const row = await ctx.db
        .query("materialCatalog")
        .withIndex("by_contentKey_and_locale", (index) =>
          index
            .eq("contentKey", projection.contentKey)
            .eq("locale", projection.locale)
        )
        .unique();
      if (!row) {
        throw new Error("Expected one active material row.");
      }
      await ctx.db.delete(row._id);
    });
    await expect(
      missing.query((ctx) =>
        runConvexProgram(
          readMaterialModel(ctx, projection.locale, projection.publicPath)
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects non-material and mismatched catalog projections", async () => {
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
        projectionJson: canonicalizeMaterialProjection(requested),
        sourcePath: "packages/corpus/material/lesson/test/other/en.mdx",
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
          assetId: projection.graph.assetId,
          bucket: "abc",
          contentKey: projection.contentKey,
          date: projection.metadata.date,
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
