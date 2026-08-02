import { internal } from "@repo/backend/convex/_generated/api";
import { PROOF_PAGE_LIMIT } from "@repo/backend/convex/contentRelease/spec";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { TEST_RELEASE_ID } from "@repo/backend/test/content-release";
import {
  insertRollbackItem,
  insertRoute,
} from "@repo/backend/test/content-rollback";
import { insertTestRelease } from "@repo/backend/test/content-stage";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const readCatalog = internal.contentRelease.proof.catalog.page;

/** Inserts one complete staged catalog larger than one proof page. */
async function insertCatalogFixture() {
  const t = convexTest(schema, convexModules);
  const itemCount = PROOF_PAGE_LIMIT + 1;
  await t.mutation(async (ctx) => {
    await insertTestRelease(ctx, {
      checkedIndex: itemCount - 1,
      checkedItems: itemCount,
      itemCount,
      projectionCount: itemCount,
      routeCount: itemCount,
      stagedArtifacts: itemCount,
      stagedItems: itemCount,
      stagedProjections: itemCount,
      stagedRoutes: itemCount,
      stagedUpserts: itemCount,
      status: "verifying",
      upsertCount: itemCount,
    });
    for (let index = 0; index < itemCount; index += 1) {
      const contentKey = `test:head-${index}`;
      const publicPath = `test/head-${index}`;
      await insertRollbackItem(ctx, index, false);
      await insertRoute(ctx, { contentKey, index, publicPath });
      await ctx.db.insert("contentKeys", {
        contentKey,
        createdSequence: 1,
        family: "material",
        locale: "en",
      });
    }
  });
  return { itemCount, t };
}

describe("contentRelease/proof/catalog", () => {
  it("advances through a full logical page without gaps or duplicates", async () => {
    const { itemCount, t } = await insertCatalogFixture();

    const first = await t.query(readCatalog, {
      cursor: null,
      releaseId: TEST_RELEASE_ID,
    });
    const second = await t.query(readCatalog, {
      cursor: first.nextCursor,
      releaseId: TEST_RELEASE_ID,
    });
    const keys = [...first.heads, ...second.heads].map(
      ({ contentKey }) => contentKey
    );

    expect(first.done).toBe(false);
    expect(first.heads).toHaveLength(PROOF_PAGE_LIMIT);
    expect(first.nextCursor).not.toBeNull();
    expect(second).toMatchObject({ done: true, nextCursor: null });
    expect(second.heads).toHaveLength(1);
    expect(new Set(keys).size).toBe(itemCount);
    expect(keys).toEqual([...keys].sort());
    expect(keys).toContain(`test:head-${itemCount - 1}`);
  });
});
