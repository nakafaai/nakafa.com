import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { canonicalizeMaterialProjection } from "@nakafa/aksara-contracts/projection/material";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import {
  validateExactMaterialRoutes,
  validateSourceMaterialRoutes,
} from "@repo/backend/convex/contentRelease/material/collision";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import { testTextHash } from "@repo/backend/test/content-release";
import {
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content-state";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material-catalog";
import {
  insertRuntimeBinding,
  insertRuntimeVersion,
} from "@repo/backend/test/runtime-head";
import type { WithoutSystemFields } from "convex/server";
import { convexTest } from "convex-test";
import { assert, describe, expect, it } from "vitest";

const RECOVERY_IDENTITY = {
  manifestHash: testTextHash("material-route-recovery"),
  releaseId: ReleaseIdSchema.make("material-route-recovery"),
  sequence: 2,
} satisfies TestIdentity;
const MATERIAL_ROUTE_KIND = "curriculum-lesson";
const MATERIAL_SECTION = "material";
type ContentRoute = WithoutSystemFields<Doc<"contentRoutes">>;

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

  it("rejects concrete routes with retained or duplicate source owners", async () => {
    const target = convexTest(schema, convexModules);
    const selected = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target, [selected]);
    const expected = [
      { contentKey: selected.contentKey, locale: selected.locale },
    ];
    const routeValues: ContentRoute = {
      ...selected.graph,
      authors: selected.metadata.authors.map(({ name }) => ({ name })),
      contentHash: "selected-concrete-route",
      content_id: selected.graph.assetId,
      kind: MATERIAL_ROUTE_KIND,
      locale: selected.locale,
      markdown: true,
      parentRoute: selected.parentPath,
      route: selected.publicPath,
      section: MATERIAL_SECTION,
      sourcePath: selected.contentKey,
      syncedAt: 1,
      title: selected.metadata.title,
    };
    const routeId = await target.mutation((ctx) =>
      ctx.db.insert("contentRoutes", routeValues)
    );

    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          validateExactMaterialRoutes(ctx, MATERIAL_IDENTITY.sequence, expected)
        )
      )
    ).resolves.toBeNull();

    await target.mutation((ctx) =>
      ctx.db.patch("contentRoutes", routeId, {
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

    await target.mutation(async (ctx) => {
      await ctx.db.patch("contentRoutes", routeId, {
        sourcePath: selected.contentKey,
      });
      await ctx.db.insert("contentRoutes", {
        ...routeValues,
        sourcePath: "material/lesson/test/duplicate",
      });
    });
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          validateExactMaterialRoutes(ctx, MATERIAL_IDENTITY.sequence, expected)
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("reserves exact routes selected by the retained recovery", async () => {
    const target = convexTest(schema, convexModules);
    const selected = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target, [selected]);
    await target.mutation(async (ctx) => {
      await insertZeroRelease(ctx, {
        ...RECOVERY_IDENTITY,
        base: MATERIAL_IDENTITY,
        ownership: { base: ["material"], result: [] },
        role: "recovery",
        status: "verified",
      });
      const state = await ctx.db.query("contentState").unique();
      assert(state, "Expected active content state.");
      await ctx.db.patch("contentState", state._id, {
        recoveryManifestHash: RECOVERY_IDENTITY.manifestHash,
        recoveryReleaseId: RECOVERY_IDENTITY.releaseId,
        recoverySequence: RECOVERY_IDENTITY.sequence,
      });
      const projectionJson = canonicalizeMaterialProjection(selected);
      await insertRuntimeVersion(ctx, "public", selected.contentKey, {
        headReleaseId: RECOVERY_IDENTITY.releaseId,
        headSequence: RECOVERY_IDENTITY.sequence,
        locale: selected.locale,
        projectionJson,
        publicPath: selected.publicPath,
        rendererDomain: "mathematics",
      });
      await insertRuntimeBinding(ctx, selected.contentKey, {
        bindingReleaseId: RECOVERY_IDENTITY.releaseId,
        bindingSequence: RECOVERY_IDENTITY.sequence,
        locale: selected.locale,
        publicPath: selected.publicPath,
      });
      await ctx.db.insert("contentOwners", {
        contentKey: selected.contentKey,
        family: "material",
        locale: selected.locale,
        managed: true,
        releaseId: RECOVERY_IDENTITY.releaseId,
        sequence: RECOVERY_IDENTITY.sequence,
      });
    });

    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          validateSourceMaterialRoutes(ctx, [
            {
              locale: selected.locale,
              publicPath: selected.publicPath,
              sourcePath: selected.contentKey,
            },
          ])
        )
      )
    ).resolves.toBeNull();

    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          validateSourceMaterialRoutes(ctx, [
            {
              locale: selected.locale,
              publicPath: selected.publicPath,
              sourcePath: "material/lesson/test/another-owner",
            },
          ])
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_ROUTE" },
    });
  });
});
