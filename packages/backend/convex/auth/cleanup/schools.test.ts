import { cleanupUserSchoolData } from "@repo/backend/convex/auth/cleanup/schools";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 6, 28, 8, 0, 0);

describe("auth/cleanup/schools", () => {
  it("preserves an owned school when no live transfer is possible", async () => {
    const t = convexTest(schema, convexModules);

    const result = await t.mutation(async (ctx) => {
      const ownerId = await ctx.db.insert("users", {
        authId: "owner-without-successor",
        credits: 0,
        creditsResetAt: 0,
        email: "owner@example.com",
        name: "School Owner",
        plan: "free",
      });
      const schoolId = await ctx.db.insert("schools", {
        city: "Jakarta",
        createdBy: ownerId,
        currentStudents: 0,
        currentTeachers: 0,
        email: "school@example.com",
        name: "Owner-only School",
        province: "DKI Jakarta",
        slug: "owner-only-school",
        type: "high-school",
        updatedAt: NOW,
      });
      const ownerMembershipId = await ctx.db.insert("schoolMembers", {
        joinedAt: NOW,
        role: "admin",
        schoolId,
        status: "active",
        updatedAt: NOW,
        userId: ownerId,
      });
      const deletingSuccessorId = await ctx.db.insert("users", {
        authId: "deleting-only-successor",
        credits: 0,
        creditsResetAt: 0,
        deletedAt: NOW,
        email: "deleting-successor@example.com",
        name: "Deleting Successor",
        plan: "free",
      });
      await ctx.db.insert("schoolMembers", {
        joinedAt: NOW,
        role: "teacher",
        schoolId,
        status: "active",
        updatedAt: NOW,
        userId: deletingSuccessorId,
      });

      let hasMore = true;

      while (hasMore) {
        hasMore = await runConvexProgram(cleanupUserSchoolData(ctx, ownerId));
      }

      return {
        ownerId,
        ownerMembership: await ctx.db.get("schoolMembers", ownerMembershipId),
        school: await ctx.db.get("schools", schoolId),
      };
    });

    expect(result.ownerMembership).toBeNull();
    expect(result.school?.createdBy).toBe(result.ownerId);
  });
});
