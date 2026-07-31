import { readVisibleMaterial } from "@repo/backend/convex/contentRelease/material/route";
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

describe("contentRelease/material/route", () => {
  it("rejects a detached catalog row resolving another active identity", async () => {
    const target = convexTest(schema, convexModules);
    const selected = makeMaterialProjection("en", 1);
    const other = makeMaterialProjection("en", 2);
    await activateMaterialCatalog(target);
    await selectExactMaterial(target, selected);

    await expect(
      target.query(async (ctx) => {
        const selectedRow = await ctx.db
          .query("materialCatalog")
          .withIndex("by_locale_and_publicPath", (index) =>
            index
              .eq("locale", selected.locale)
              .eq("publicPath", selected.publicPath)
          )
          .unique();
        const otherRow = await ctx.db
          .query("materialCatalog")
          .withIndex("by_locale_and_publicPath", (index) =>
            index.eq("locale", other.locale).eq("publicPath", other.publicPath)
          )
          .unique();
        if (!(selectedRow && otherRow)) {
          throw new Error("Expected two material catalog rows.");
        }
        return runConvexProgram(
          readVisibleMaterial(ctx, { ...selectedRow, _id: otherRow._id }, false)
        );
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
