import { loadMaterialIdentityOwner } from "@repo/backend/convex/contentRelease/material/owner";
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

describe("contentRelease/material/owner", () => {
  it("ignores stale exact material ownership after family cutover", async () => {
    const target = convexTest(schema, convexModules);
    const material = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target, [material]);
    await target.mutation((ctx) =>
      ctx.db.insert("contentOwners", {
        contentKey: material.contentKey,
        family: "material",
        locale: material.locale,
        managed: true,
        releaseId: "release-prior",
        sequence: 0,
      })
    );

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          loadMaterialIdentityOwner(ctx, material.contentKey, material.locale)
        )
      )
    ).resolves.toMatchObject({
      exactManaged: false,
      managed: true,
    });
  });

  it("rejects exact ownership from another family", async () => {
    const target = convexTest(schema, convexModules);
    const material = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target, [material]);
    await target.mutation((ctx) =>
      ctx.db.insert("contentOwners", {
        contentKey: material.contentKey,
        family: "article",
        locale: material.locale,
        managed: true,
        releaseId: MATERIAL_IDENTITY.releaseId,
        sequence: MATERIAL_IDENTITY.sequence,
      })
    );

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          loadMaterialIdentityOwner(ctx, material.contentKey, material.locale)
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
