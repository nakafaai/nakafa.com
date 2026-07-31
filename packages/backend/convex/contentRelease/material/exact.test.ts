import { MaterialLessonProjectionSchema } from "@nakafa/aksara-contracts/projection/material";
import {
  finalizeExactMaterialOwners,
  loadExactMaterialOwners,
  readExactMaterialSnapshot,
  validateExactMaterialOwnerScope,
} from "@repo/backend/convex/contentRelease/material/exact";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
  selectExactMaterial,
} from "@repo/backend/test/material-catalog";
import { convexTest } from "convex-test";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("contentRelease/material/exact", () => {
  it("reconciles one exact owner and clears it at family cutover", async () => {
    const target = convexTest(schema, convexModules);
    const selected = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target, [selected]);
    await selectExactMaterial(target, selected);
    await target.mutation((ctx) =>
      ctx.db.insert("contentOwners", {
        contentKey: "article/test/exact-transition",
        family: "article",
        locale: "en",
        managed: true,
        releaseId: MATERIAL_IDENTITY.releaseId,
        sequence: MATERIAL_IDENTITY.sequence,
      })
    );
    await target.mutation((ctx) =>
      runConvexProgram(
        finalizeExactMaterialOwners(ctx, {
          releaseId: MATERIAL_IDENTITY.releaseId,
          resultFamilies: ["article"],
          sequence: MATERIAL_IDENTITY.sequence,
        })
      )
    );

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readExactMaterialSnapshot(ctx, MATERIAL_IDENTITY, "en")
        )
      )
    ).resolves.toMatchObject({
      materials: [{ row: { contentKey: selected.contentKey } }],
      owners: [{ contentKey: selected.contentKey }],
    });

    await target.mutation(async (ctx) => {
      const owner = await ctx.db
        .query("contentOwners")
        .withIndex("by_contentKey_and_locale_and_sequence", (index) =>
          index
            .eq("contentKey", selected.contentKey)
            .eq("locale", selected.locale)
            .eq("sequence", MATERIAL_IDENTITY.sequence)
        )
        .unique();
      if (!owner) {
        expect.fail("Expected one exact content owner.");
      }
      await ctx.db.patch("contentOwners", owner._id, { managed: false });
      await runConvexProgram(
        finalizeExactMaterialOwners(ctx, {
          releaseId: MATERIAL_IDENTITY.releaseId,
          resultFamilies: ["article"],
          sequence: MATERIAL_IDENTITY.sequence,
        })
      );
    });
    await expect(
      target.run((ctx) => ctx.db.query("materialOwners").take(1))
    ).resolves.toEqual([]);

    await target.mutation(async (ctx) => {
      const owner = await ctx.db
        .query("contentOwners")
        .withIndex("by_contentKey_and_locale_and_sequence", (index) =>
          index
            .eq("contentKey", selected.contentKey)
            .eq("locale", selected.locale)
            .eq("sequence", MATERIAL_IDENTITY.sequence)
        )
        .unique();
      if (!owner) {
        expect.fail("Expected one exact content owner.");
      }
      await ctx.db.patch("contentOwners", owner._id, { managed: true });
      await runConvexProgram(
        finalizeExactMaterialOwners(ctx, {
          releaseId: MATERIAL_IDENTITY.releaseId,
          resultFamilies: ["article"],
          sequence: MATERIAL_IDENTITY.sequence,
        })
      );
      await runConvexProgram(
        finalizeExactMaterialOwners(ctx, {
          releaseId: MATERIAL_IDENTITY.releaseId,
          resultFamilies: ["material"],
          sequence: MATERIAL_IDENTITY.sequence,
        })
      );
    });
    await expect(
      target.run((ctx) => ctx.db.query("materialOwners").take(1))
    ).resolves.toEqual([]);
  });

  it("rejects stale and oversized exact owner projections", async () => {
    const stale = convexTest(schema, convexModules);
    await stale.mutation((ctx) =>
      ctx.db.insert("materialOwners", {
        contentKey: "material/lesson/test/stale",
        locale: "en",
        releaseId: MATERIAL_IDENTITY.releaseId,
        sequence: 0,
      })
    );
    await expect(
      stale.query((ctx) =>
        runConvexProgram(loadExactMaterialOwners(ctx, MATERIAL_IDENTITY))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const oversized = convexTest(schema, convexModules);
    await oversized.mutation(async (ctx) => {
      for (let index = 0; index < 65; index += 1) {
        await ctx.db.insert("materialOwners", {
          contentKey: `material/lesson/test/owner-${index}`,
          locale: "en",
          releaseId: MATERIAL_IDENTITY.releaseId,
          sequence: MATERIAL_IDENTITY.sequence,
        });
      }
    });
    await expect(
      oversized.query((ctx) =>
        runConvexProgram(loadExactMaterialOwners(ctx, MATERIAL_IDENTITY, "en"))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });

  it("rejects cumulative exact material overflow before activation", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation(async (ctx) => {
      for (let index = 0; index < 64; index += 1) {
        await ctx.db.insert("materialOwners", {
          contentKey: `material/lesson/test/stored-${index}`,
          locale: "en",
          releaseId: "release-prior",
          sequence: 0,
        });
      }
      await ctx.db.insert("contentOwners", {
        contentKey: "material/lesson/test/next",
        family: "material",
        locale: "en",
        managed: true,
        releaseId: MATERIAL_IDENTITY.releaseId,
        sequence: MATERIAL_IDENTITY.sequence,
      });
    });

    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          validateExactMaterialOwnerScope(ctx, {
            releaseId: MATERIAL_IDENTITY.releaseId,
            resultFamilies: ["article"],
            sequence: MATERIAL_IDENTITY.sequence,
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });

  it("rejects exact ownership that changes a permanent content family", async () => {
    const target = convexTest(schema, convexModules);
    const selected = makeMaterialProjection("en", 1);
    await target.mutation(async (ctx) => {
      await ctx.db.insert("contentKeys", {
        contentKey: selected.contentKey,
        createdSequence: 0,
        family: "material",
        locale: selected.locale,
      });
      await ctx.db.insert("contentOwners", {
        contentKey: selected.contentKey,
        family: "article",
        locale: selected.locale,
        managed: true,
        releaseId: MATERIAL_IDENTITY.releaseId,
        sequence: MATERIAL_IDENTITY.sequence,
      });
    });

    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          validateExactMaterialOwnerScope(ctx, {
            releaseId: MATERIAL_IDENTITY.releaseId,
            resultFamilies: ["article"],
            sequence: MATERIAL_IDENTITY.sequence,
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects exact material search ownership above one locale window", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation(async (ctx) => {
      for (let index = 0; index < 33; index += 1) {
        const contentKey = `material/lesson/test/locale-${index}`;
        await ctx.db.insert("contentKeys", {
          contentKey,
          createdSequence: 0,
          family: "material",
          locale: "en",
        });
        await ctx.db.insert("contentOwners", {
          contentKey,
          family: "material",
          locale: "en",
          managed: true,
          releaseId: MATERIAL_IDENTITY.releaseId,
          sequence: MATERIAL_IDENTITY.sequence,
        });
      }
    });

    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          validateExactMaterialOwnerScope(ctx, {
            releaseId: MATERIAL_IDENTITY.releaseId,
            resultFamilies: ["article"],
            sequence: MATERIAL_IDENTITY.sequence,
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });

  it("rejects exact owners that split one material group across parents", async () => {
    const target = convexTest(schema, convexModules);
    const first = makeMaterialProjection("en", 1);
    const second = makeMaterialProjection("en", 2);
    const conflicting = Schema.decodeUnknownSync(
      MaterialLessonProjectionSchema
    )({
      ...second,
      parentPath: "subjects/mathematics/other-topic",
      publicPath: "subjects/mathematics/other-topic/section-2",
    });
    await activateMaterialCatalog(target, [first, conflicting]);
    await selectExactMaterial(target, first);
    await target.mutation(async (ctx) => {
      await ctx.db.insert("contentKeys", {
        contentKey: first.contentKey,
        createdSequence: 0,
        family: "material",
        locale: first.locale,
      });
      await ctx.db.insert("contentKeys", {
        contentKey: conflicting.contentKey,
        createdSequence: 0,
        family: "material",
        locale: conflicting.locale,
      });
      await ctx.db.insert("contentOwners", {
        contentKey: conflicting.contentKey,
        family: "material",
        locale: conflicting.locale,
        managed: true,
        releaseId: MATERIAL_IDENTITY.releaseId,
        sequence: MATERIAL_IDENTITY.sequence,
      });
    });

    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          validateExactMaterialOwnerScope(ctx, {
            releaseId: MATERIAL_IDENTITY.releaseId,
            resultFamilies: ["article"],
            sequence: MATERIAL_IDENTITY.sequence,
          })
        )
      )
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_INTEGRITY",
        message:
          "Material en/lesson.mathematics.technical-topic would split one lesson group across parents.",
      },
    });
  });
});
