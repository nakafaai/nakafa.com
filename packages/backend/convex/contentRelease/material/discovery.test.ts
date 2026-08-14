import {
  readLatestMaterials,
  readMaterialBucket,
} from "@repo/backend/convex/contentRelease/material/discovery";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material-catalog";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentRelease/material/discovery", () => {
  it("returns bounded unmanaged discovery and rejects invalid limits", async () => {
    const target = convexTest(schema, convexModules);

    await expect(
      target.query((ctx) =>
        runConvexProgram(readMaterialBucket(ctx, "en", "abc"))
      )
    ).resolves.toEqual({
      activeReleaseId: null,
      managed: false,
      materials: null,
    });
    await expect(
      target.query((ctx) => runConvexProgram(readLatestMaterials(ctx, "en", 2)))
    ).resolves.toEqual({
      activeReleaseId: null,
      managed: false,
      materials: [],
    });
    for (const limit of [0, 101, 1.5]) {
      await expect(
        target.query((ctx) =>
          runConvexProgram(readLatestMaterials(ctx, "en", limit))
        )
      ).rejects.toMatchObject({
        data: { code: "CONTENT_RELEASE_LIMIT" },
      });
    }
  });

  it("reads complete partitions and newest-first material summaries", async () => {
    const target = convexTest(schema, convexModules);
    await activateMaterialCatalog(target);
    const count = await target.run((ctx) =>
      ctx.db
        .query("materialBuckets")
        .withIndex("by_locale_and_bucket", (query) => query.eq("locale", "en"))
        .first()
    );
    if (!count) {
      throw new Error("Expected one material discovery bucket.");
    }

    await expect(
      target.query((ctx) =>
        runConvexProgram(readMaterialBucket(ctx, "en", "fff"))
      )
    ).resolves.toEqual({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
      managed: true,
      materials: null,
    });
    await expect(
      target.query((ctx) =>
        runConvexProgram(readMaterialBucket(ctx, "en", count.bucket))
      )
    ).resolves.toMatchObject({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
      managed: true,
      materials: [
        {
          authors: [{ name: "Nakafa" }],
          date: "2026-07-24",
          publicPath: expect.stringContaining("subjects/mathematics/"),
          title: expect.stringContaining("EN Section"),
        },
      ],
    });
    await expect(
      target.query((ctx) => runConvexProgram(readLatestMaterials(ctx, "en", 1)))
    ).resolves.toMatchObject({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
      managed: true,
      materials: [{ date: "2026-07-24", title: "EN Section 2" }],
    });
  });
});
