import { describe, expect, it } from "@effect/vitest";
import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { readMaterialPublication } from "@repo/backend/convex/contentRelease/material/publication";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import { activateMaterialCatalog } from "@repo/backend/test/material/catalog";
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";

const readPublication = makeFunctionReference<
  "query",
  { readonly appLocale: ActiveAppLocaleCode; readonly publicPath: string },
  {
    readonly model: {
      readonly alternateJson: readonly string[];
      readonly projectionJson: null | string;
      readonly siblingJson: readonly string[];
    };
    readonly runtime: null | {
      readonly artifactJson: string;
      readonly projectionJson: string;
    };
  }
>("contentRelease/material/runtime:read");

describe("contentRelease/material/publication", () => {
  it("uses 14 indexed operations for three locales and one section", async () => {
    const target = convexTest(schema, convexModules);
    const projections = (["en", "id", "de"] as const).map((appLocale) =>
      makeMaterialProjection(appLocale, 1)
    );
    const requested = projections[0];
    await activateMaterialCatalog(target, projections);

    const { metrics, result } = await target.query(async (ctx) => {
      const publication = await runConvexProgram(
        readMaterialPublication(ctx, requested.appLocale, requested.publicPath)
      );
      return {
        metrics: await ctx.meta.getTransactionMetrics(),
        result: publication,
      };
    });

    expect(result.model.alternateJson).toHaveLength(3);
    expect(result.model.siblingJson).toHaveLength(1);
    expect(result.runtime?.projectionJson).toBe(result.model.projectionJson);
    expect(metrics.databaseQueries.used).toBe(14);
  });

  it("serves the registered cohesive reader and preserves missing routes", async () => {
    const target = convexTest(schema, convexModules);
    const requested = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target);

    const found = await target.query(readPublication, {
      appLocale: requested.appLocale,
      publicPath: requested.publicPath,
    });
    expect(found.runtime).not.toBeNull();
    expect(
      JSON.parse(found.runtime?.artifactJson ?? "{}").payload.contentKey
    ).toBe(requested.contentKey);

    await expect(
      target.query(readPublication, {
        appLocale: "en",
        publicPath: "subjects/test/missing",
      })
    ).resolves.toMatchObject({
      model: { projectionJson: null },
      runtime: null,
    });
  });

  it("fails closed when the selected signed artifact is missing", async () => {
    const target = convexTest(schema, convexModules);
    const requested = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target);
    await target.mutation(async (ctx) => {
      const head = await ctx.db
        .query("contentHeads")
        .withIndex("by_contentKey_and_artifactLocale_and_sequence", (index) =>
          index
            .eq("contentKey", requested.contentKey)
            .eq("artifactLocale", requested.artifactLocale)
            .eq("sequence", 1)
        )
        .unique();
      if (!head?.artifactHash) {
        throw new Error("Expected one material runtime head.");
      }
      const artifact = await ctx.db
        .query("contentArtifacts")
        .withIndex("by_artifactHash", (index) =>
          index.eq("artifactHash", head.artifactHash ?? "")
        )
        .unique();
      if (!artifact) {
        throw new Error("Expected one material runtime artifact.");
      }
      await ctx.db.delete("contentArtifacts", artifact._id);
    });

    await expect(
      target.query(readPublication, {
        appLocale: requested.appLocale,
        publicPath: requested.publicPath,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_MISSING" },
    });
  });
});
