import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { tryoutLifecycleHandler } from "@repo/backend/convex/triggers/tryouts/lifecycle";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("triggers/tryouts/lifecycle", () => {
  it("blocks the trigger fallback after cutover initialization", async () => {
    const t = convexTest(schema, convexModules);
    const claim = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "auth-tryout-lifecycle-trigger",
        credits: 0,
        creditsResetAt: 1,
        email: "tryout-lifecycle-trigger@example.com",
        name: "Try-out Lifecycle Trigger",
        plan: "free",
      });
      const claimId = await ctx.db.insert("tryoutFreeAttemptClaims", {
        claimedAt: 1,
        countryKey: "indonesia",
        examKey: "snbt",
        setKey: "set-1",
        trackKey: "2027",
        userId,
      });
      const stored = await ctx.db.get("tryoutFreeAttemptClaims", claimId);
      if (!stored) {
        throw new Error("Expected try-out lifecycle claim fixture.");
      }
      return stored;
    });

    await expect(
      t.mutation((ctx) =>
        tryoutLifecycleHandler(ctx, {
          id: claim._id,
          newDoc: claim,
          oldDoc: null,
          operation: "insert",
        })
      )
    ).resolves.toBeNull();

    await t.mutation(insertCutoverState);

    await expect(
      t.mutation((ctx) =>
        tryoutLifecycleHandler(ctx, {
          id: claim._id,
          newDoc: claim,
          oldDoc: claim,
          operation: "update",
        })
      )
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_CUTOVER_FROZEN" },
    });
  });
});

function insertCutoverState(ctx: MutationCtx) {
  return ctx.db.insert("contentCutoverState", {
    auditedActiveReleaseId: "active-release",
    auditedActiveSequence: 1,
    auditedAt: 1,
    auditedLegacyWriteVersion: 0,
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
    phase: "quiescent",
    updatedAt: 1,
  });
}
