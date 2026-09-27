import { assert, expect, it } from "@effect/vitest";
import { MODEL_BUILD_PAGE_ROWS } from "@repo/backend/confect/contentRelease/models/spec";
import { validateSearchModel } from "@repo/backend/confect/contentRelease/search/validation";
import { writeSearchEntry } from "@repo/backend/confect/contentRelease/search/write";
import { runConvexProgram } from "@repo/backend/confect/runtime";
import { convexModules } from "@repo/backend/confect/test.setup";
import schema from "@repo/backend/convex/schema";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import { insertModelBuild } from "@repo/backend/test/content/model";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material/catalog";
import { convexTest } from "convex-test";

it("validates all search pages and rejects a stale row beyond the first page", async () => {
  const t = convexTest(schema, convexModules);
  const projections = Array.from(
    { length: MODEL_BUILD_PAGE_ROWS + 1 },
    (_, index) => makeMaterialProjection("en", index + 1)
  );
  await activateMaterialCatalog(t, projections);
  const stored = await t.mutation(async (ctx) => {
    for (const projection of projections) {
      const head = await ctx.db
        .query("contentHeads")
        .withIndex("by_contentKey_and_artifactLocale_and_sequence", (index) =>
          index
            .eq("contentKey", projection.contentKey)
            .eq("artifactLocale", "en")
        )
        .unique();
      assert(head);
      await runConvexProgram(
        writeSearchEntry(
          ctx,
          "green",
          head,
          projection,
          "Published lesson body"
        )
      );
    }
    const build = await insertModelBuild(ctx, "searchVerify");
    await ctx.db.patch(build._id, {
      releaseId: MATERIAL_IDENTITY.releaseId,
      manifestHash: MATERIAL_IDENTITY.manifestHash,
      sequence: MATERIAL_IDENTITY.sequence,
    });
    const current = await ctx.db.get(build._id);
    const release = await ctx.db.query("contentReleases").unique();
    assert(current && release);
    return { build: current, release };
  });
  const first = await t.mutation((ctx) =>
    runConvexProgram(validateSearchModel(ctx, stored.build, stored.release))
  );
  expect(first).toMatchObject({
    done: false,
    processed: MODEL_BUILD_PAGE_ROWS,
    cursor: expect.any(String),
  });
  assert(first.cursor);
  const next = { ...stored.build, cursor: first.cursor };
  await expect(
    t.mutation((ctx) =>
      runConvexProgram(validateSearchModel(ctx, next, stored.release))
    )
  ).resolves.toEqual({ done: true, processed: 1, cursor: undefined });
  await t.mutation(async (ctx) => {
    const last = await ctx.db
      .query("contentIndex")
      .withIndex("by_slot_and_contentKey_and_appLocale", (index) =>
        index.eq("slot", "green")
      )
      .order("desc")
      .first();
    assert(last);
    await ctx.db.patch(last._id, {
      projectionHash: `sha256:${"f".repeat(64)}`,
    });
  });
  await expect(
    t.mutation((ctx) =>
      runConvexProgram(validateSearchModel(ctx, next, stored.release))
    )
  ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
});
