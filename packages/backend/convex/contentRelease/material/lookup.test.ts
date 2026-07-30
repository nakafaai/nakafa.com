import { canonicalizeMaterialProjection } from "@nakafa/aksara-contracts/projection/material";
import { lookupMaterial } from "@repo/backend/convex/contentRelease/material/lookup";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import {
  activateMaterialCatalog,
  selectExactMaterial,
} from "@repo/backend/test/material-catalog";
import { convexTest } from "convex-test";
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
