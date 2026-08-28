import { describe, expect, it } from "@effect/vitest";
import { readArticleDates } from "@repo/backend/convex/contentRelease/article/dates";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { insertRuntimeArticles } from "@repo/backend/test/content/runtime";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("contentRelease/article/dates", () => {
  it("accepts equal bridge dates and rejects contradictions", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertRuntimeArticles(ctx, 1));
    const row = await t.run((ctx) => ctx.db.query("articleCatalog").unique());
    if (!(row && "datePublished" in row)) {
      throw new Error("Expected one dual-written article date row.");
    }

    await expect(Effect.runPromise(readArticleDates(row))).resolves.toEqual({
      datePublished: row.datePublished,
    });
    const { date: _date, ...current } = row;
    await expect(Effect.runPromise(readArticleDates(current))).resolves.toEqual(
      {
        datePublished: row.datePublished,
      }
    );
    await expect(
      Effect.runPromise(readArticleDates({ ...row, date: "2020-01-01" }))
    ).rejects.toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
  });
});
