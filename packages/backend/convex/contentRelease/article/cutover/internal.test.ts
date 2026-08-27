import { describe, expect, it } from "@effect/vitest";
import type {
  ArticleDateCutoverReceipt,
  ArticleDateCutoverRequest,
  ArticleDateCutoverStatus,
} from "@repo/backend/convex/contentRelease/article/cutover/spec";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { insertRuntimeArticles } from "@repo/backend/test/content/runtime";
import { TEST_RUNTIME_RELEASE } from "@repo/backend/test/runtime/values";
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";

const REQUEST = {
  expectedManifestHash: TEST_RUNTIME_RELEASE.manifestHash,
  expectedReleaseId: TEST_RUNTIME_RELEASE.releaseId,
  expectedSequence: TEST_RUNTIME_RELEASE.sequence,
} satisfies ArticleDateCutoverRequest;

const statusReference = makeFunctionReference<
  "query",
  ArticleDateCutoverRequest,
  ArticleDateCutoverStatus
>("contentRelease/article/cutover/internal:status");
const removeReference = makeFunctionReference<
  "mutation",
  ArticleDateCutoverRequest,
  ArticleDateCutoverReceipt
>("contentRelease/article/cutover/internal:removeLegacyDate");
const restoreReference = makeFunctionReference<
  "mutation",
  ArticleDateCutoverRequest,
  ArticleDateCutoverReceipt
>("contentRelease/article/cutover/internal:restoreLegacyDate");

describe("contentRelease/article/cutover/internal", () => {
  it("registers exact status, removal, and inverse boundaries", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 1);
      const row = await ctx.db.query("articleCatalog").unique();
      if (!(row && "datePublished" in row)) {
        throw new Error("Expected one current article date.");
      }
      await ctx.db.patch("articleCatalog", row._id, {
        date: row.datePublished,
      });
    });

    await expect(t.query(statusReference, REQUEST)).resolves.toMatchObject({
      counts: { currentOnly: 0, dual: 1, legacyOnly: 0, total: 1 },
    });
    await expect(t.mutation(removeReference, REQUEST)).resolves.toMatchObject({
      changed: 1,
      operation: "remove",
    });
    await expect(t.mutation(restoreReference, REQUEST)).resolves.toMatchObject({
      changed: 1,
      operation: "restore",
    });
  });
});
