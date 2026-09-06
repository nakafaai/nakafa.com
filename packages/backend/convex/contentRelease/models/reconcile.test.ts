import { expect, it } from "@effect/vitest";
import { reconcileModel } from "@repo/backend/convex/contentRelease/models/reconcile";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { insertModelBuild } from "@repo/backend/test/content/model";
import { stream } from "convex-helpers/server/stream";
import { convexTest } from "convex-test";
import { Effect } from "effect";

it("fails closed when a supplied stream filters an identity before reconciliation", async () => {
  const t = convexTest(schema, convexModules);
  const build = await t.mutation(async (ctx) => {
    await ctx.db.insert("contentIndex", {
      appLocale: "en",
      contentKey: "article:filtered",
      family: "article",
      projectionHash: "sha256:projection",
      publicPath: "articles/filtered",
      releaseId: "active",
      sequence: 1,
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
      const query = stream(ctx.db, schema).query("contentIndex");
      return runConvexProgram(
        reconcileModel({
          build,
          source: query
            .withIndex("by_slot_and_contentKey_and_appLocale", (index) =>
              index.eq("slot", "blue")
            )
            .filterWith(() => Promise.resolve(false)),
          target: query.withIndex(
            "by_slot_and_contentKey_and_appLocale",
            (index) => index.eq("slot", "green")
          ),
          sourceSlot: "blue",
          targetSlot: "green",
          indexFields: ["contentKey", "appLocale"],
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
      message: "Model phase search lost an indexed reconciliation row.",
    },
  });
  expect(insert).not.toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});
