import {
  readLatestMaterials,
  readMaterialBucket,
} from "@repo/backend/convex/contentRelease/material/discovery";
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

describe("contentRelease/material/discovery", () => {
  it("returns bounded unmanaged discovery and rejects invalid limits", async () => {
    const target = convexTest(schema, convexModules);

    await expect(
      target.query((ctx) =>
        runConvexProgram(readMaterialBucket(ctx, "en", "abc"))
      )
    ).resolves.toEqual({ managed: false, materials: null });
    await expect(
      target.query((ctx) => runConvexProgram(readLatestMaterials(ctx, "en", 2)))
    ).resolves.toEqual({
      claimedContentKeys: [],
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
    ).resolves.toEqual({ managed: true, materials: null });
    await expect(
      target.query((ctx) =>
        runConvexProgram(readMaterialBucket(ctx, "en", count.bucket))
      )
    ).resolves.toMatchObject({
      managed: true,
      materials: [
        {
          authors: [{ name: "Nakafa" }],
          date: "2026-07-24",
          publicPath: expect.stringContaining("subjects/test/"),
          title: expect.stringContaining("EN Section"),
        },
      ],
    });
    await expect(
      target.query((ctx) => runConvexProgram(readLatestMaterials(ctx, "en", 1)))
    ).resolves.toMatchObject({
      managed: true,
      materials: [{ date: "2026-07-24", title: "EN Section 2" }],
    });
  });

  it("fails closed while exact material ownership is still synchronizing", async () => {
    const target = convexTest(schema, convexModules);
    await activateMaterialCatalog(target);
    await selectExactMaterial(target, makeMaterialProjection("en", 1));
    await target.mutation(async (ctx) => {
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected active content state.");
      }
      await ctx.db.patch("contentState", state._id, {
        materialManifestHash: undefined,
        materialReleaseId: undefined,
        materialSequence: undefined,
      });
    });

    await expect(
      target.query((ctx) => runConvexProgram(readLatestMaterials(ctx, "en", 2)))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
  });
});
