import { readContentReference } from "@repo/backend/convex/contentRelease/reference/read";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content-runtime";
import { activateMaterialCatalog } from "@repo/backend/test/material-catalog";
import { makeQuranSearch } from "@repo/backend/test/quran-rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran-snapshot";
import {
  activateTryoutSnapshot,
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout-snapshot";
import { convexTest } from "convex-test";
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
});
