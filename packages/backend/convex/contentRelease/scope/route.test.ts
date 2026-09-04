import { describe, expect, it } from "@effect/vitest";
import { resolveActiveRoute } from "@repo/backend/convex/contentRelease/scope/route";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import { activateMaterialCatalog } from "@repo/backend/test/material/catalog";
import { convexTest } from "convex-test";

describe("contentRelease/scope/route", () => {
  it("rejects a route locale outside the signed application contract", async () => {
    const target = convexTest(schema, convexModules);

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          resolveActiveRoute(ctx, "material", "fr", "subjects/test")
        )
      )
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_INTEGRITY",
        message:
          "Route locale fr violates the current application-locale contract.",
      },
    });
  });

  it("distinguishes an unmanaged family from a managed route", async () => {
    const target = convexTest(schema, convexModules);
    const requested = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target);

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          resolveActiveRoute(
            ctx,
            "article",
            requested.appLocale,
            requested.publicPath
          )
        )
      )
    ).resolves.toMatchObject({ managed: false, projection: null });
  });

  it.each(["identity", "projection"] as const)(
    "fails closed when a managed route loses its %s proof",
    async (corruption) => {
      const target = convexTest(schema, convexModules);
      const requested = makeMaterialProjection("en", 1);
      await activateMaterialCatalog(target);
      await target.mutation(async (ctx) => {
        const binding = await ctx.db
          .query("contentBindings")
          .withIndex(
            "by_appLocale_and_publicPath_and_sequence_and_index",
            (index) =>
              index
                .eq("appLocale", requested.appLocale)
                .eq("publicPath", requested.publicPath)
                .eq("sequence", 1)
          )
          .unique();
        if (!binding) {
          return expect.fail("Expected one active material binding.");
        }
        await ctx.db.patch("contentBindings", binding._id, {
          contentKey:
            corruption === "identity"
              ? undefined
              : "material/lesson/test/missing/section",
        });
      });

      await expect(
        target.query((ctx) =>
          runConvexProgram(
            resolveActiveRoute(
              ctx,
              "material",
              requested.appLocale,
              requested.publicPath
            )
          )
        )
      ).rejects.toMatchObject({
        data: { code: "CONTENT_RELEASE_INTEGRITY" },
      });
    }
  );
});
