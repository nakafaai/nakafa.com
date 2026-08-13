import {
  readMaterialBuckets,
  readMaterialSitemap,
} from "@repo/backend/convex/contentRelease/material/sitemap";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material-catalog";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentRelease/material/sitemap", () => {
  it("returns empty discovery before signed ownership", async () => {
    const target = convexTest(schema, convexModules);

    await expect(
      target.query((ctx) => runConvexProgram(readMaterialBuckets(ctx, "en")))
    ).resolves.toEqual({
      activeReleaseId: null,
      buckets: [],
      managed: false,
      materialCount: 0,
    });
    await expect(
      target.query((ctx) =>
        runConvexProgram(readMaterialSitemap(ctx, "en", "abc"))
      )
    ).resolves.toBeNull();
  });

  it("lists and reads complete active material partitions", async () => {
    const target = convexTest(schema, convexModules);
    const first = makeMaterialProjection("en", 1);
    const second = makeMaterialProjection("en", 2);
    await activateMaterialCatalog(target, [first, second]);
    const result = await target.query((ctx) =>
      runConvexProgram(readMaterialBuckets(ctx, "en"))
    );

    expect(result).toMatchObject({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
      managed: true,
      materialCount: 2,
    });
    expect(result.buckets.length).toBeGreaterThan(0);
    const pages = await Promise.all(
      result.buckets.map((bucket) =>
        target.query((ctx) =>
          runConvexProgram(readMaterialSitemap(ctx, "en", bucket))
        )
      )
    );
    expect(pages.flatMap((page) => page?.routes ?? [])).toEqual(
      expect.arrayContaining([
        { date: "2026-07-24", publicPath: first.publicPath },
        { date: "2026-07-24", publicPath: second.publicPath },
      ])
    );
  });

  it("rejects malformed stored partition metadata", async () => {
    const target = convexTest(schema, convexModules);
    await activateMaterialCatalog(target);
    await target.mutation((ctx) =>
      ctx.db.insert("materialBuckets", {
        bucket: "invalid",
        count: 0,
        locale: "en",
      })
    );

    await expect(
      target.query((ctx) => runConvexProgram(readMaterialBuckets(ctx, "en")))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
