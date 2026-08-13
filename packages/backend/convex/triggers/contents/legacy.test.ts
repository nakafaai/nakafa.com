import { deleteLegacyPage } from "@repo/backend/convex/contentRelease/cutover/legacy";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { legacyContentWriteHandler } from "@repo/backend/convex/triggers/contents/legacy";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("triggers/contents/legacy", () => {
  it("blocks legacy writers while the raw cutover drain owns deletion", async () => {
    const t = convexTest(schema, convexModules);
    const author = await t.mutation(async (ctx) => {
      const id = await ctx.db.insert("authors", {
        name: "Legacy Author",
        username: "legacy-author",
      });
      const stored = await ctx.db.get(id);
      if (!stored) {
        throw new Error("Expected legacy author fixture.");
      }
      await legacyContentWriteHandler(ctx, {
        id,
        newDoc: stored,
        oldDoc: null,
        operation: "insert",
      });
      return stored;
    });
    await expect(
      t.query((ctx) => ctx.db.query("contentCutoverActivity").unique())
    ).resolves.toMatchObject({ key: "legacy", version: 1 });
    await t.mutation((ctx) =>
      ctx.db.insert("contentCutoverState", {
        auditedActiveReleaseId: "active-release",
        auditedActiveSequence: 1,
        auditedAt: 1,
        auditedLegacyWriteVersion: 1,
        auditedNextSequence: 2,
        currentDeleted: 0,
        currentTableDeleted: 0,
        currentTableIndex: 0,
        currentTablePreserved: 0,
        inventoryVersion: "production-2026-08-13",
        key: "phase1",
        legacyDeleted: 0,
        legacyTableDeleted: 0,
        legacyTableIndex: 0,
        phase: "audited",
        readerCutoverAcceptedAt: 1,
        updatedAt: 1,
      })
    );

    await expect(
      t.mutation((ctx) =>
        legacyContentWriteHandler(ctx, {
          id: author._id,
          newDoc: author,
          oldDoc: author,
          operation: "update",
        })
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          deleteLegacyPage(ctx, [
            { batchSize: 1, expected: 1, table: "authors" },
          ])
        )
      )
    ).resolves.toMatchObject({ complete: true, deleted: 1 });
  });
});
