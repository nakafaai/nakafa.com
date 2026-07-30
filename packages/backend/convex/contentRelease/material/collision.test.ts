import { validateExactMaterialRoutes } from "@repo/backend/convex/contentRelease/material/collision";
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

describe("contentRelease/material/collision", () => {
  it("rejects exact routes that displace a retained source owner", async () => {
    const target = convexTest(schema, convexModules);
    const selected = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target, [selected]);
    const expected = [
      { contentKey: selected.contentKey, locale: selected.locale },
    ];
    const sourceRouteId = await target.mutation((ctx) =>
      ctx.db.insert("publicRoutes", {
        contentHash: "selected-source-route",
        kind: selected.kind,
        locale: selected.locale,
        publicPath: selected.publicPath,
        sitemap: selected.sitemap,
        sourcePath: selected.contentKey,
        syncShard: 0,
        title: selected.metadata.title,
      })
    );

    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          validateExactMaterialRoutes(ctx, MATERIAL_IDENTITY.sequence, expected)
        )
      )
    ).resolves.toBeNull();

    await target.mutation((ctx) =>
      ctx.db.patch("publicRoutes", sourceRouteId, {
        sourcePath: "material/lesson/test/retained",
      })
    );
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          validateExactMaterialRoutes(ctx, MATERIAL_IDENTITY.sequence, expected)
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_ROUTE" },
    });
  });
});
