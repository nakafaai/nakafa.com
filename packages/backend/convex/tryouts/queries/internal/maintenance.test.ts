import { internal } from "@repo/backend/convex/_generated/api";
import {
  createTryoutTestConvex,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

describe("tryouts/queries/internal/maintenance", () => {
  it("reports missing and duplicate control integrity issues", async () => {
    const t = createTryoutTestConvex();

    await t.mutation(async (ctx) => {
      await ctx.db.insert("users", {
        authId: "auth-missing-control",
        credits: 0,
        creditsResetAt: NOW,
        email: "missing-control@example.com",
        name: "Missing Control",
        plan: "free",
      });
      const duplicateUserId = await ctx.db.insert("users", {
        authId: "auth-duplicate-control",
        credits: 0,
        creditsResetAt: NOW,
        email: "duplicate-control@example.com",
        name: "Duplicate Control",
        plan: "free",
      });

      await ctx.db.insert("userTryoutControls", {
        updatedAt: NOW,
        userId: duplicateUserId,
      });
      await ctx.db.insert("userTryoutControls", {
        updatedAt: NOW + 1,
        userId: duplicateUserId,
      });
    });

    const result = await t.query(
      internal.tryouts.queries.internal.maintenance
        .getUserTryoutControlIntegrity,
      {
        paginationOpts: {
          cursor: null,
          numItems: 100,
        },
      }
    );

    expect(result).toMatchObject({
      duplicateControlUserCount: 1,
      isDone: true,
      missingControlUserCount: 1,
      usersScanned: 2,
    });
    expect(result.userIdsNeedingRepair).toHaveLength(2);
  });
});
