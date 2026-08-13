import { CUTOVER_INVENTORY_VERSION } from "@repo/backend/convex/contentRelease/cutover/inventory";
import { RETIRED_PROGRAM_ZERO_RECEIPT } from "@repo/backend/convex/contentRelease/cutover/retiredPrograms";
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
        retiredProgramZeroReceipt: RETIRED_PROGRAM_ZERO_RECEIPT,
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
