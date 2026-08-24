import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
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
    await target.mutation(async (ctx) => {
      const newest = await ctx.db
        .query("materialCatalog")
        .withIndex("by_contentKey_and_appLocale", (index) =>
          index
            .eq(
              "contentKey",
              "material/lesson/mathematics/technical-topic/section-2"
            )
            .eq("appLocale", "en")
        )
        .unique();
      if (!newest) {
        throw new Error("Expected the newest material catalog row.");
      }
      if (!("datePublished" in newest)) {
        throw new Error("Expected one current material date shape.");
      }
      const {
        _creationTime: _createdAt,
        _id,
        dateModified: _dateModified,
        datePublished,
        ...fields
      } = newest;
      await ctx.db.replace("materialCatalog", _id, {
        ...fields,
        date: datePublished,
      });
    });
    const count = await target.run((ctx) =>
      ctx.db
        .query("materialBuckets")
        .withIndex("by_appLocale_and_bucket", (query) =>
          query.eq("appLocale", "en")
        )
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
          datePublished: "2026-07-24",
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
      materials: [{ datePublished: "2026-07-24", title: "EN Section 2" }],
    });
  });

  it.each(ACTIVE_APP_LOCALE_CODES)(
    "reads current %s material routes and dates from the localized catalog",
    async (appLocale) => {
      const target = convexTest(schema, convexModules);
      await activateMaterialCatalog(target);
      const expected = makeMaterialProjection(appLocale, 2);

      await expect(
        target.query((ctx) =>
          runConvexProgram(readLatestMaterials(ctx, appLocale, 1))
        )
      ).resolves.toMatchObject({
        activeReleaseId: MATERIAL_IDENTITY.releaseId,
        managed: true,
        materials: [
          {
            datePublished: expected.metadata.datePublished,
            publicPath: expected.publicPath,
            title: expected.metadata.title,
          },
        ],
      });
    }
  );
});
