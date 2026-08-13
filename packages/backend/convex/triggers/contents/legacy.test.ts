import { internal } from "@repo/backend/convex/_generated/api";
import { deleteLegacyPage } from "@repo/backend/convex/contentRelease/cutover/legacy";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("triggers/contents/legacy", () => {
  it("blocks legacy writers while the raw cutover drain owns deletion", async () => {
    const t = convexTest(schema, convexModules);
    const created = await t.mutation(
      internal.contentSync.mutations.authors.bulkSyncAuthors,
      { authorNames: ["Legacy Author"] }
    );
    expect(created.created).toBe(1);
    const author = await t.query((ctx) => ctx.db.query("authors").unique());
    if (!author) {
      throw new Error("Expected legacy author fixture.");
    }
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
        updatedAt: 1,
      })
    );

    await expect(
      t.mutation(internal.contentSync.mutations.authors.bulkSyncAuthors, {
        authorNames: ["Blocked Author"],
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
    await expect(
      t.mutation(internal.contentSync.mutations.authors.deleteUnusedAuthors, {
        authorIds: [author._id],
      })
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
