import { CUTOVER_INVENTORY_VERSION } from "@repo/backend/convex/contentRelease/cutover/inventory";
import { initializeProgram } from "@repo/backend/convex/contentRelease/cutover/quiescence";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const acceptAudit = makeFunctionReference<
  "mutation",
  Record<string, never>,
  null
>("contentRelease/cutover/quiescence:acceptAudit");

describe("contentRelease/cutover/quiescence", () => {
  it("rejects initialization after the audited legacy-write token changes", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.mutation(async (ctx) => {
        await ctx.db.insert("contentCutoverActivity", {
          key: "legacy",
          updatedAt: 1,
          version: 2,
        });
        await runConvexProgram(initializeProgram(ctx, 1));
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
    await expect(
      t.run((ctx) => ctx.db.query("contentCutoverState").take(1))
    ).resolves.toEqual([]);
  });

  it("does not accept the inventory before the audio journal is clean", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentCutoverState", {
        auditedActiveReleaseId: "active-release",
        auditedActiveSequence: 1,
        auditedAt: 1,
        auditedLegacyWriteVersion: 0,
        auditedNextSequence: 2,
        currentDeleted: 0,
        currentTableDeleted: 0,
        currentTableIndex: 0,
        currentTablePreserved: 0,
        inventoryVersion: CUTOVER_INVENTORY_VERSION,
        key: "phase1",
        legacyDeleted: 0,
        legacyTableDeleted: 0,
        legacyTableIndex: 0,
        phase: "quiescent",
        updatedAt: 1,
      });
    });

    await expect(t.mutation(acceptAudit, {})).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_INTEGRITY",
        message: expect.stringContaining("journal has not been cleaned"),
      },
    });
  });
});
