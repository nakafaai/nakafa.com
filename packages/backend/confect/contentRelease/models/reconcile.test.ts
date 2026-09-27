import { DatabaseReader } from "@confect/server";
import { expect, it } from "@effect/vitest";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { reconcileModel } from "@repo/backend/confect/contentRelease/models/reconcile";
import { runConvexProgram } from "@repo/backend/confect/runtime";
import { convexModules } from "@repo/backend/confect/test.setup";
import schema from "@repo/backend/convex/schema";
import { insertModelBuild } from "@repo/backend/test/content/model";
import { convexTest } from "convex-test";
import { Effect } from "effect";

it("fails closed when a stored indexed row violates its decoded contract", async () => {
  const t = convexTest(schema, convexModules);
  const build = await t.mutation(async (ctx) => {
    await ctx.db.insert("contentIndex", {
      appLocale: "en",
      contentKey: "article:filtered",
      family: "article",
      projectionHash: "sha256:projection",
      publicPath: "articles/filtered",
      releaseId: "active",
      sequence: Number.NaN,
      slot: "blue",
      text: "A public article must not silently disappear.",
    });
    return insertModelBuild(ctx, "search");
  });
  const insert = vi.fn(() => Effect.void);
  const replace = vi.fn(() => Effect.void);
  const remove = vi.fn(() => Effect.void);
  await expect(
    t.mutation((ctx) => {
      const query = DatabaseReader.make(databaseSchema, ctx.db).table(
        "contentIndex"
      );
      return runConvexProgram(
        reconcileModel({
          build,
          source: query.stream(
            "by_slot_and_contentKey_and_appLocale",
            (index) => index.eq("slot", "blue")
          ),
          target: query.stream(
            "by_slot_and_contentKey_and_appLocale",
            (index) => index.eq("slot", "green")
          ),
          sourceSlot: "blue",
          targetSlot: "green",
          position: (row) => [row.contentKey, row.appLocale],
          insert,
          replace,
          remove,
        })
      );
    })
  ).rejects.toMatchObject({
    data: {
      code: "CONTENT_RELEASE_INTEGRITY",
      message: "Model phase search contains an invalid stored row.",
    },
  });
  expect(insert).not.toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});
