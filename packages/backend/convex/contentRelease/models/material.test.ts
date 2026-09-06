import { assert, describe, expect, it } from "@effect/vitest";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { reconcileMaterialModel } from "@repo/backend/convex/contentRelease/models/material";
import type { ModelSlot } from "@repo/backend/convex/contentRelease/models/slot";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import { insertModelBuild } from "@repo/backend/test/content/model";
import { activateMaterialCatalog } from "@repo/backend/test/material/catalog";
import { convexTest, type TestConvex } from "convex-test";

async function reconcile(
  t: TestConvex<typeof schema>,
  build: Doc<"contentModelBuilds">
) {
  let writes = 0;
  for (const phase of ["materialCatalog", "materialBuckets"] as const) {
    let cursor: string | undefined;
    let pages = 0;
    do {
      const result = await t.mutation(async (ctx) => ({
        page: await runConvexProgram(
          reconcileMaterialModel(ctx, { ...build, phase, cursor })
        ),
        metrics: await ctx.meta.getTransactionMetrics(),
      }));
      writes += result.metrics.documentsWritten.used;
      cursor = result.page.cursor;
      pages += 1;
    } while (cursor !== undefined && pages < 100);
    expect(cursor).toBeUndefined();
  }
  return writes;
}

function read(t: TestConvex<typeof schema>, slot: ModelSlot) {
  return t.query(async (ctx) => ({
    catalog: await ctx.db
      .query("materialCatalog")
      .withIndex(
        "by_slot_and_appLocale_and_parentPath_and_order_and_publicPath",
        (index) => index.eq("slot", slot)
      )
      .take(100),
    buckets: await ctx.db
      .query("materialBuckets")
      .withIndex("by_slot_and_appLocale_and_bucket", (index) =>
        index.eq("slot", slot)
      )
      .take(100),
  }));
}

function values(row: Doc<"materialCatalog" | "materialBuckets">) {
  const { _creationTime, _id, slot, ...fields } = row;
  return fields;
}

describe("contentRelease/models/material", () => {
  it("preserves curriculum ordering and counts while reconciling aborted buffer changes", async () => {
    const t = convexTest({
      schema,
      modules: convexModules,
      transactionLimits: true,
    });
    await activateMaterialCatalog(
      t,
      Array.from({ length: 40 }, (_, index) =>
        makeMaterialProjection("en", index + 1)
      )
    );
    const build = await t.mutation((ctx) =>
      insertModelBuild(ctx, "materialCatalog")
    );
    const source = await read(t, "blue");
    const expected = {
      catalog: source.catalog.map(values),
      buckets: source.buckets.map(values),
    };
    expect(await reconcile(t, build)).toBe(
      source.catalog.length + source.buckets.length
    );
    const initial = await read(t, "green");
    expect(await reconcile(t, build)).toBe(0);
    await expect(read(t, "green")).resolves.toEqual(initial);

    await t.mutation(async (ctx) => {
      const [missingMaterial, changedMaterial] = initial.catalog;
      const [missingBucket, changedBucket] = initial.buckets;
      assert(
        missingMaterial && changedMaterial && missingBucket && changedBucket
      );
      await ctx.db.delete("materialCatalog", missingMaterial._id);
      await ctx.db.patch("materialCatalog", changedMaterial._id, {
        order: 999,
        dateModified: "2099-01-01",
      });
      const {
        _id: materialId,
        _creationTime: materialCreated,
        ...material
      } = missingMaterial;
      await ctx.db.insert("materialCatalog", {
        ...material,
        contentKey: "material:aborted",
      });
      await ctx.db.delete("materialBuckets", missingBucket._id);
      await ctx.db.patch("materialBuckets", changedBucket._id, { count: 999 });
      const {
        _id: bucketId,
        _creationTime: bucketCreated,
        ...bucket
      } = missingBucket;
      await ctx.db.insert("materialBuckets", { ...bucket, bucket: "aborted" });
    });

    expect(await reconcile(t, build)).toBe(6);
    const repaired = await read(t, "green");
    expect({
      catalog: repaired.catalog.map(values),
      buckets: repaired.buckets.map(values),
    }).toEqual(expected);
    await expect(read(t, "blue")).resolves.toEqual(source);
    expect(await reconcile(t, build)).toBe(0);
  });
});
