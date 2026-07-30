import {
  canonicalizeMaterialProjection,
  MaterialLessonProjectionSchema,
} from "@nakafa/aksara-contracts/projection/material";
import { lookupMaterial } from "@repo/backend/convex/contentRelease/material/lookup";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import { insertContentViewRoute } from "@repo/backend/test/content-view";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
  selectExactMaterial,
} from "@repo/backend/test/material-catalog";
import { convexTest } from "convex-test";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("contentRelease/material/lookup", () => {
  it("keeps unknown source-owned identities unmanaged", async () => {
    const target = convexTest(schema, convexModules);

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          lookupMaterial(ctx, {
            contentId: "asset:en:material:test:missing",
            kind: "content",
          })
        )
      )
    ).resolves.toEqual({
      activeReleaseId: null,
      managed: false,
      route: null,
    });
  });

  it("resolves family-owned routes and graph assets", async () => {
    const target = convexTest(schema, convexModules);
    const projection = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target, [projection]);

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          lookupMaterial(ctx, {
            kind: "route",
            locale: projection.locale,
            publicPath: projection.publicPath,
          })
        )
      )
    ).resolves.toEqual({
      activeReleaseId: "release-test",
      managed: true,
      route: {
        locale: projection.locale,
        publicPath: projection.publicPath,
      },
    });
    await expect(
      target.query((ctx) =>
        runConvexProgram(
          lookupMaterial(ctx, {
            contentId: projection.graph.assetId,
            kind: "content",
          })
        )
      )
    ).resolves.toEqual({
      activeReleaseId: "release-test",
      managed: true,
      route: {
        locale: projection.locale,
        publicPath: projection.publicPath,
      },
    });
    await expect(
      target.query((ctx) =>
        runConvexProgram(
          lookupMaterial(ctx, {
            contentId: "asset:en:material:test:missing",
            kind: "content",
          })
        )
      )
    ).resolves.toEqual({
      activeReleaseId: "release-test",
      managed: true,
      route: null,
    });
  });

  it("exposes only the selected exact material owner", async () => {
    const target = convexTest(schema, convexModules);
    const selected = makeMaterialProjection("en", 1);
    const sourceOwned = makeMaterialProjection("en", 2);
    await activateMaterialCatalog(target, [selected, sourceOwned]);
    await selectExactMaterial(target, selected);

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          lookupMaterial(ctx, {
            contentId: selected.graph.assetId,
            kind: "content",
          })
        )
      )
    ).resolves.toMatchObject({ managed: true });
    await expect(
      target.query((ctx) =>
        runConvexProgram(
          lookupMaterial(ctx, {
            contentId: sourceOwned.graph.assetId,
            kind: "content",
          })
        )
      )
    ).resolves.toEqual({
      activeReleaseId: "release-test",
      managed: false,
      route: null,
    });
  });

  it("redirects one exact source URL through its stable identity", async () => {
    const target = convexTest(schema, convexModules);
    const source = makeMaterialProjection("en", 1);
    const renamed = Schema.decodeUnknownSync(MaterialLessonProjectionSchema)({
      ...source,
      publicPath: `${source.parentPath}/renamed`,
    });
    await activateMaterialCatalog(target, [renamed]);
    await selectExactMaterial(target, renamed);
    await target.mutation((ctx) =>
      insertContentViewRoute(ctx, {
        contentId: source.graph.assetId,
        graph: source.graph,
        kind: "curriculum-lesson",
        locale: source.locale,
        route: source.publicPath,
        section: "material",
        sourcePath: source.contentKey,
        title: source.metadata.title,
      })
    );

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          lookupMaterial(ctx, {
            kind: "route",
            locale: source.locale,
            publicPath: source.publicPath,
          })
        )
      )
    ).resolves.toEqual({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
      managed: true,
      route: {
        locale: renamed.locale,
        publicPath: renamed.publicPath,
      },
    });
  });

  it("keeps one exact source tombstone managed without a route binding", async () => {
    const target = convexTest(schema, convexModules);
    const selected = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target, [selected]);
    await selectExactMaterial(target, selected);
    await target.mutation(async (ctx) => {
      await insertContentViewRoute(ctx, {
        contentId: selected.graph.assetId,
        graph: selected.graph,
        kind: "curriculum-lesson",
        locale: selected.locale,
        route: selected.publicPath,
        section: "material",
        sourcePath: selected.contentKey,
        title: selected.metadata.title,
      });
      const binding = await ctx.db
        .query("contentBindings")
        .withIndex("by_locale_and_publicPath_and_sequence_and_index", (index) =>
          index
            .eq("locale", selected.locale)
            .eq("publicPath", selected.publicPath)
            .eq("sequence", MATERIAL_IDENTITY.sequence)
        )
        .unique();
      const head = await ctx.db
        .query("contentHeads")
        .withIndex("by_contentKey_and_locale_and_sequence", (index) =>
          index
            .eq("contentKey", selected.contentKey)
            .eq("locale", selected.locale)
            .eq("sequence", MATERIAL_IDENTITY.sequence)
        )
        .unique();
      const catalog = await ctx.db
        .query("materialCatalog")
        .withIndex("by_contentKey_and_locale", (index) =>
          index
            .eq("contentKey", selected.contentKey)
            .eq("locale", selected.locale)
        )
        .unique();
      if (!(binding && head && catalog)) {
        throw new Error("Expected one complete exact material fixture.");
      }
      await ctx.db.delete("contentBindings", binding._id);
      await ctx.db.patch("contentHeads", head._id, { operation: "delete" });
    });

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          lookupMaterial(ctx, {
            contentId: selected.graph.assetId,
            kind: "content",
          })
        )
      )
    ).resolves.toEqual({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
      managed: true,
      route: null,
    });
    await expect(
      target.query((ctx) =>
        runConvexProgram(
          lookupMaterial(ctx, {
            kind: "route",
            locale: selected.locale,
            publicPath: selected.publicPath,
          })
        )
      )
    ).resolves.toEqual({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
      managed: true,
      route: null,
    });
    await target.mutation(async (ctx) => {
      const catalog = await ctx.db
        .query("materialCatalog")
        .withIndex("by_contentKey_and_locale", (index) =>
          index
            .eq("contentKey", selected.contentKey)
            .eq("locale", selected.locale)
        )
        .unique();
      if (!catalog) {
        throw new Error("Expected one material catalog row.");
      }
      await ctx.db.delete("materialCatalog", catalog._id);
    });
    await expect(
      target.query((ctx) =>
        runConvexProgram(
          lookupMaterial(ctx, {
            contentId: selected.graph.assetId,
            kind: "content",
          })
        )
      )
    ).resolves.toEqual({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
      managed: true,
      route: null,
    });
    await expect(
      target.query((ctx) =>
        runConvexProgram(
          lookupMaterial(ctx, {
            kind: "route",
            locale: selected.locale,
            publicPath: selected.publicPath,
          })
        )
      )
    ).resolves.toEqual({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
      managed: true,
      route: null,
    });
  });

  it("rejects one asset assigned to multiple locales", async () => {
    const target = convexTest(schema, convexModules);
    const projection = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target, [projection]);
    await target.mutation((ctx) =>
      ctx.db.insert("materialCatalog", {
        assetId: projection.graph.assetId,
        bucket: "corrupt",
        contentKey: projection.contentKey,
        date: projection.metadata.date,
        locale: "id",
        materialKey: projection.materialKey,
        order: projection.order,
        parentPath: projection.parentPath,
        projectionHash: "corrupt",
        projectionJson: canonicalizeMaterialProjection(projection),
        publicPath: projection.publicPath,
        releaseId: "corrupt",
        rendererDomain: "mathematics",
        sequence: 1,
        sourcePath: "corrupt",
      })
    );

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          lookupMaterial(ctx, {
            contentId: projection.graph.assetId,
            kind: "content",
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
