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
  insertMaterialProjection,
  MATERIAL_IDENTITY,
  selectExactMaterial,
} from "@repo/backend/test/material-catalog";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentRelease/material/sitemap", () => {
  it("returns empty unmanaged discovery and no unmanaged page", async () => {
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
    await activateMaterialCatalog(target);
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
        {
          date: "2026-07-24",
          publicPath: "subjects/test/technical-topic/section-1",
        },
        {
          date: "2026-07-24",
          publicPath: "subjects/test/technical-topic/section-2",
        },
      ])
    );
  });

  it("lists partial buckets while returning only exact-owned routes", async () => {
    const target = convexTest(schema, convexModules);
    const selected = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target);
    await selectExactMaterial(target, selected);
    const result = await target.query((ctx) =>
      runConvexProgram(readMaterialBuckets(ctx, "en"))
    );

    expect(result).toMatchObject({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
      managed: false,
      materialCount: 1,
    });
    expect(result.buckets).toHaveLength(1);
    const pages = await Promise.all(
      result.buckets.map((bucket) =>
        target.query((ctx) =>
          runConvexProgram(readMaterialSitemap(ctx, "en", bucket))
        )
      )
    );
    expect(pages.flatMap((page) => page?.routes ?? [])).toEqual([
      {
        date: selected.metadata.date,
        publicPath: selected.publicPath,
      },
    ]);
  });

  it("lists one exact owner beyond the former catalog scan window", async () => {
    const target = convexTest(schema, convexModules);
    const selected = makeMaterialProjection("en", 1, 66);
    const unowned = Array.from({ length: 65 }, (_, index) =>
      makeMaterialProjection("en", index + 1, index + 1)
    );
    await activateMaterialCatalog(target, unowned);
    await target.mutation((ctx) => insertMaterialProjection(ctx, selected));
    await selectExactMaterial(target, selected);

    const result = await target.query((ctx) =>
      runConvexProgram(readMaterialBuckets(ctx, "en"))
    );

    expect(result).toMatchObject({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
      managed: false,
      materialCount: 1,
    });
    expect(result.buckets).toHaveLength(1);
    await expect(
      target.query((ctx) =>
        runConvexProgram(readMaterialSitemap(ctx, "en", result.buckets[0]))
      )
    ).resolves.toEqual({
      routes: [
        {
          date: selected.metadata.date,
          publicPath: selected.publicPath,
        },
      ],
    });
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
