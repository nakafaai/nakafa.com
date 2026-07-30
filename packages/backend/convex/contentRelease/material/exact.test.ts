import {
  finalizeExactMaterialOwners,
  loadExactMaterialOwners,
  readExactMaterialSnapshot,
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
import { describe, expect, it } from "vitest";

describe("contentRelease/material/exact", () => {
  it("reconciles one exact owner and clears it at family cutover", async () => {
    const target = convexTest(schema, convexModules);
    const selected = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target, [selected]);
    await selectExactMaterial(target, selected);
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
      const owner = await ctx.db.query("contentOwners").unique();
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
      const owner = await ctx.db.query("contentOwners").unique();
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
});
