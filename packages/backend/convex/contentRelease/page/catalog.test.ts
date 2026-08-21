import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { readPageCatalog } from "@repo/backend/convex/contentRelease/page/catalog";
import { PAGE_CATALOG_LIMIT } from "@repo/backend/convex/contentRelease/page/limits";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { insertTestPage } from "@repo/backend/test/content-page";
import { insertRuntimeRelease } from "@repo/backend/test/content-runtime";
import { TEST_RUNTIME_RELEASE } from "@repo/backend/test/runtime-values";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentRelease/page/catalog", () => {
  it("keeps page ownership absent before its signed family cutover", async () => {
    const empty = convexTest(schema, convexModules);
    await expect(
      empty.query((ctx) => runConvexProgram(readPageCatalog(ctx)))
    ).resolves.toEqual({
      activeReleaseId: null,
      managed: false,
      projectionJson: [],
    });

    const materialOnly = convexTest(schema, convexModules);
    await materialOnly.mutation((ctx) =>
      insertRuntimeRelease(ctx, ["material"])
    );
    await expect(
      materialOnly.query((ctx) => runConvexProgram(readPageCatalog(ctx)))
    ).resolves.toEqual({
      activeReleaseId: TEST_RUNTIME_RELEASE.releaseId,
      managed: false,
      projectionJson: [],
    });
  });

  it("returns every current locale-equivalent page in canonical order", async () => {
    const t = convexTest(schema, convexModules);
    const expected: string[] = [];
    await t.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx, ["page"]);
      for (const appLocale of ACTIVE_APP_LOCALE_CODES) {
        const terms = await insertTestPage(
          ctx,
          appLocale,
          "terms-of-service",
          "terms-of-service",
          0
        );
        const imprint = await insertTestPage(ctx, appLocale, "imprint");
        expected.push(imprint, terms);
      }
      await ctx.db.insert("contentKeys", {
        artifactLocale: "en",
        contentKey: "pages/retired",
        createdSequence: TEST_RUNTIME_RELEASE.sequence,
        family: "page",
      });
    });

    await expect(
      t.query((ctx) => runConvexProgram(readPageCatalog(ctx)))
    ).resolves.toEqual({
      activeReleaseId: TEST_RUNTIME_RELEASE.releaseId,
      managed: true,
      projectionJson: expected,
    });
  });

  it("rejects incomplete locale parity and an unbounded identity catalog", async () => {
    const incomplete = convexTest(schema, convexModules);
    await incomplete.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx, ["page"]);
      await insertTestPage(ctx, "en");
    });
    await expect(
      incomplete.query((ctx) => runConvexProgram(readPageCatalog(ctx)))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const oversized = convexTest(schema, convexModules);
    await oversized.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx, ["page"]);
      for (let index = 0; index <= PAGE_CATALOG_LIMIT; index += 1) {
        await ctx.db.insert("contentKeys", {
          artifactLocale: "en",
          contentKey: ContentKeySchema.make(`pages/technical-${index}`),
          createdSequence: TEST_RUNTIME_RELEASE.sequence,
          family: "page",
        });
      }
    });
    await expect(
      oversized.query((ctx) => runConvexProgram(readPageCatalog(ctx)))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_LIMIT" } });
  });
});
