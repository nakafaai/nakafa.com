import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { FUNCTION_MATERIAL } from "@repo/backend/test/content-material";
import {
  seedLearningProgramCatalog,
  seedTestContentRoute,
  selectTestProgram,
  syncTestGraphCoverage,
  TEST_NOW,
} from "@repo/backend/test/learning-programs";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
  selectExactMaterial,
} from "@repo/backend/test/material-catalog";
import { describe, expect, it } from "vitest";

describe("learningPrograms/queries", () => {
  it("resolves stored plan items through current exact material ownership", async () => {
    const target = createConvexTestWithBetterAuth();
    const identity = await target.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: TEST_NOW })
    );
    const material = FUNCTION_MATERIAL;
    const oldRoute =
      "subjects/mathematics/function-composition-inverse-function/old-concept";
    const routeId = await seedTestContentRoute(target, {
      graph: material.graph,
      locale: "en",
      route: oldRoute,
      title: "Old Function Concept",
    });
    await target.mutation((ctx) =>
      ctx.db.patch(routeId, { sourcePath: material.contentKey })
    );
    await seedLearningProgramCatalog(target);
    await syncTestGraphCoverage(target, {
      graph: material.graph,
      lensScope: "curriculum",
      locale: "en",
      programKey: "merdeka",
    });
    const { authed } = await selectTestProgram(target, identity, {
      locale: "en",
    });

    await expect(
      authed.query(api.learningPrograms.queries.getActiveProfile, {})
    ).resolves.toMatchObject({
      planItems: [{ route: oldRoute, title: "Old Function Concept" }],
    });

    await activateMaterialCatalog(target, [material]);
    await selectExactMaterial(target, material);

    await expect(
      authed.query(api.learningPrograms.queries.getActiveProfile, {
        locale: "en",
      })
    ).resolves.toMatchObject({
      planItems: [
        {
          route: material.publicPath,
          title: material.metadata.title,
        },
      ],
    });

    await target.mutation(async (ctx) => {
      const [binding, catalog, head] = await Promise.all([
        ctx.db
          .query("contentBindings")
          .withIndex(
            "by_locale_and_publicPath_and_sequence_and_index",
            (index) =>
              index
                .eq("locale", material.locale)
                .eq("publicPath", material.publicPath)
                .eq("sequence", MATERIAL_IDENTITY.sequence)
          )
          .unique(),
        ctx.db
          .query("materialCatalog")
          .withIndex("by_contentKey_and_locale", (index) =>
            index
              .eq("contentKey", material.contentKey)
              .eq("locale", material.locale)
          )
          .unique(),
        ctx.db
          .query("contentHeads")
          .withIndex("by_contentKey_and_locale_and_sequence", (index) =>
            index
              .eq("contentKey", material.contentKey)
              .eq("locale", material.locale)
              .eq("sequence", MATERIAL_IDENTITY.sequence)
          )
          .unique(),
      ]);
      if (!(binding && catalog && head)) {
        throw new Error("Expected one complete exact material fixture.");
      }
      await ctx.db.delete("contentBindings", binding._id);
      await ctx.db.delete("materialCatalog", catalog._id);
      await ctx.db.patch("contentHeads", head._id, { operation: "delete" });
    });

    const tombstoned = await authed.query(
      api.learningPrograms.queries.getActiveProfile,
      { locale: "en" }
    );
    expect(tombstoned).toMatchObject({
      planItems: [
        {
          content_id: material.graph.assetId,
        },
      ],
    });
    expect(tombstoned?.planItems[0]).not.toHaveProperty("route");
    expect(tombstoned?.planItems[0]).not.toHaveProperty("title");
  });
});
