import { deriveMaterialTopicReference } from "@repo/backend/convex/contentRelease/material/topic";
import { readContentReference } from "@repo/backend/convex/contentRelease/reference/read";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content-runtime";
import {
  activateMaterialCatalog,
  advanceMaterialCatalog,
  insertMaterialProjection,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material-catalog";
import { makeQuranSearch } from "@repo/backend/test/quran-rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran-snapshot";
import {
  activateTryoutSnapshot,
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout-snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("contentRelease/reference/read", () => {
  it("resolves current signed articles by route and graph identity", async () => {
    const target = convexTest(schema, convexModules);
    const article = testArticleProjection(0);
    await target.mutation((ctx) => insertRuntimeArticles(ctx, 1));

    for (const input of [
      {
        kind: "route" as const,
        locale: article.locale,
        publicPath: article.publicPath,
      },
      { contentId: article.graph.assetId, kind: "content" as const },
    ]) {
      await expect(
        target.query((ctx) =>
          runConvexProgram(readContentReference(ctx, input))
        )
      ).resolves.toMatchObject({
        content_id: article.graph.assetId,
        route: article.publicPath,
        section: "articles",
        title: article.metadata.title,
      });
    }
  });

  it("resolves current signed materials by route and graph identity", async () => {
    const target = convexTest(schema, convexModules);
    const material = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target, [material]);

    for (const input of [
      {
        kind: "route" as const,
        locale: material.locale,
        publicPath: material.publicPath,
      },
      { contentId: material.graph.assetId, kind: "content" as const },
    ]) {
      await expect(
        target.query((ctx) =>
          runConvexProgram(readContentReference(ctx, input))
        )
      ).resolves.toMatchObject({
        content_id: material.graph.assetId,
        route: material.publicPath,
        section: "material",
        title: material.metadata.title,
      });
    }
  });

  it("resolves one material topic through its signed lesson representative", async () => {
    const target = convexTest(schema, convexModules);
    const material = makeMaterialProjection("en", 1);
    const topic = await Effect.runPromise(
      deriveMaterialTopicReference(material)
    );
    await activateMaterialCatalog(target, [material]);

    for (const input of [
      {
        kind: "route" as const,
        locale: topic.locale,
        publicPath: topic.publicPath,
      },
      { contentId: topic.graph.assetId, kind: "content" as const },
    ]) {
      await expect(
        target.query((ctx) =>
          runConvexProgram(readContentReference(ctx, input))
        )
      ).resolves.toMatchObject({
        content_id: topic.graph.assetId,
        route: topic.publicPath,
        section: "material",
        title: topic.title,
      });
    }
  });

  it("resolves inherited material lessons and topics at the active sequence", async () => {
    const target = convexTest(schema, convexModules);
    const material = makeMaterialProjection("en", 1);
    const topic = await Effect.runPromise(
      deriveMaterialTopicReference(material)
    );
    await activateMaterialCatalog(target);
    await advanceMaterialCatalog(target);

    for (const expected of [
      {
        contentId: material.graph.assetId,
        route: material.publicPath,
        title: material.metadata.title,
      },
      {
        contentId: topic.graph.assetId,
        route: topic.publicPath,
        title: topic.title,
      },
    ]) {
      await expect(
        target.query((ctx) =>
          runConvexProgram(
            readContentReference(ctx, {
              contentId: expected.contentId,
              kind: "content",
            })
          )
        )
      ).resolves.toMatchObject({
        content_id: expected.contentId,
        route: expected.route,
        section: "material",
        title: expected.title,
      });
    }
  });

  it("resolves one active signed Quran identity", async () => {
    const target = convexTest(schema, convexModules);
    const quran = makeQuranSearch("en", 1);
    await target.mutation((ctx) => activateQuranSnapshot(ctx, [quran]));

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readContentReference(ctx, {
            contentId: quran.graph.assetId,
            kind: "content",
          })
        )
      )
    ).resolves.toMatchObject({
      content_id: quran.graph.assetId,
      route: quran.route,
      section: "quran",
      title: quran.title,
    });
  });

  it("resolves one active signed try-out identity", async () => {
    const target = convexTest(schema, convexModules);
    const tryout = makeTryoutCatalogRow("en").record.row;
    await target.mutation((ctx) =>
      activateTryoutSnapshot(ctx, {
        catalog: [tryout, makeTryoutCatalogRow("id").record.row],
        placements: [
          makeTryoutPlacementRow("en").record.row,
          makeTryoutPlacementRow("id").record.row,
        ],
      })
    );

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readContentReference(ctx, {
            kind: "route",
            locale: "en",
            publicPath: "try-out/indonesia",
          })
        )
      )
    ).resolves.toMatchObject({
      content_id: tryout.graph.assetId,
      route: "try-out/indonesia",
      section: "tryout",
      title: tryout.title,
    });
  });

  it("returns null when no active signed family owns the identity", async () => {
    const target = convexTest(schema, convexModules);

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readContentReference(ctx, {
            kind: "route",
            locale: "en",
            publicPath: "articles/missing/item",
          })
        )
      )
    ).resolves.toBeNull();
  });

  it("does not authenticate an unrelated try-out catalog", async () => {
    const target = convexTest(schema, convexModules);
    const material = makeMaterialProjection("en", 1);
    await target.mutation(async (ctx) => {
      await activateTryoutSnapshot(ctx, {
        catalog: [
          makeTryoutCatalogRow("en").record.row,
          makeTryoutCatalogRow("id").record.row,
        ],
        placements: [
          makeTryoutPlacementRow("en").record.row,
          makeTryoutPlacementRow("id").record.row,
        ],
      });
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected one active signed publication.");
      }
      await ctx.db.patch("contentState", state._id, {
        materialManifestHash: MATERIAL_IDENTITY.manifestHash,
        materialReleaseId: MATERIAL_IDENTITY.releaseId,
        materialSequence: MATERIAL_IDENTITY.sequence,
      });
      await insertMaterialProjection(ctx, material);
      const unrelated = await ctx.db.query("tryoutCatalog").first();
      if (!unrelated) {
        throw new Error("Expected one unrelated try-out row.");
      }
      await ctx.db.patch("tryoutCatalog", unrelated._id, {
        rowJson: "invalid-unrelated-row",
      });
    });

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readContentReference(ctx, {
            contentId: material.graph.assetId,
            kind: "content",
          })
        )
      )
    ).resolves.toMatchObject({
      content_id: material.graph.assetId,
      section: "material",
    });
  });
});
