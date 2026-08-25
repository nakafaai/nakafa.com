import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  insertRuntimeArticles,
  testLocalizedArticleProjection,
} from "@repo/backend/test/content-runtime";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const category = api.contentRelease.article.category;

describe("contentRelease/article/category", () => {
  it.each(["en", "id", "de"] as const)(
    "retains the predecessor %s category lookup during the bridge",
    async (appLocale) => {
      const target = convexTest(schema, convexModules);
      await target.mutation((ctx) =>
        insertRuntimeArticles(ctx, 1, (index) =>
          testLocalizedArticleProjection(index, appLocale)
        )
      );

      await expect(
        target.query(category, { appLocale, category: "politics" })
      ).resolves.toEqual({ exists: true, managed: true });
    }
  );

  it("returns an unmanaged result before a signed release is active", async () => {
    const target = convexTest(schema, convexModules);

    await expect(
      target.query(category, { appLocale: "en", category: "politics" })
    ).resolves.toEqual({ exists: false, managed: false });
  });
});
