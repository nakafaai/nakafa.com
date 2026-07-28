import { cleanupUserSchoolData } from "@repo/backend/convex/auth/cleanup/schools";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 6, 28, 8, 0, 0);

describe("auth/cleanup/schools", () => {
  it("transfers an owned school before deleting the former owner membership", async () => {
    const t = convexTest(schema, convexModules);

    const result = await t.mutation(async (ctx) => {
      const ownerId = await ctx.db.insert("users", {
        authId: "deleted-school-owner",
        credits: 0,
        creditsResetAt: 0,
        email: "owner@example.com",
        name: "School Owner",
        plan: "free",
      });
      const deletingCandidateId = await ctx.db.insert("users", {
        authId: "deleting-school-successor",
        credits: 0,
        creditsResetAt: 0,
        deletedAt: NOW,
        email: "deleting-successor@example.com",
        name: "Deleting School Successor",
        plan: "free",
      });
      const successorId = await ctx.db.insert("users", {
        authId: "school-successor",
        credits: 0,
        creditsResetAt: 0,
        email: "successor@example.com",
        name: "School Successor",
        plan: "free",
      });
      const schoolId = await ctx.db.insert("schools", {
        city: "Jakarta",
        createdBy: ownerId,
        currentStudents: 1,
        currentTeachers: 0,
        email: "school@example.com",
        name: "Shared School",
        province: "DKI Jakarta",
        slug: "shared-school",
        type: "high-school",
        updatedAt: NOW,
      });
      await ctx.db.insert("schoolMembers", {
        joinedAt: NOW,
        role: "admin",
        schoolId,
        status: "active",
        updatedAt: NOW,
        userId: ownerId,
      });
      await ctx.db.insert("schoolMembers", {
        joinedAt: NOW,
        role: "teacher",
        schoolId,
        status: "active",
        updatedAt: NOW,
        userId: deletingCandidateId,
      });
      const successorMembershipId = await ctx.db.insert("schoolMembers", {
        joinedAt: NOW,
        role: "student",
        schoolId,
        status: "active",
        updatedAt: NOW,
        userId: successorId,
      });

      let hasMore = true;

      while (hasMore) {
        hasMore = await runConvexProgram(cleanupUserSchoolData(ctx, ownerId));
      }

      return {
        ownerMemberships: await ctx.db
          .query("schoolMembers")
          .withIndex("by_userId_and_status", (query) =>
            query.eq("userId", ownerId)
          )
          .collect(),
        school: await ctx.db.get("schools", schoolId),
        successorMembership: await ctx.db.get(
          "schoolMembers",
          successorMembershipId
        ),
      };
    });

    expect(result.ownerMemberships).toEqual([]);
    expect(result.school).toMatchObject({
      createdBy: result.successorMembership?.userId,
      updatedBy: result.successorMembership?.userId,
    });
    expect(result.successorMembership).toMatchObject({
      role: "admin",
      status: "active",
    });
  });

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

      const outcome = await runConvexProgram(
        Effect.either(cleanupUserSchoolData(ctx, ownerId))
      );

      return {
        errorTag: outcome._tag === "Left" ? outcome.left._tag : null,
        ownerMembership: await ctx.db.get("schoolMembers", ownerMembershipId),
        school: await ctx.db.get("schools", schoolId),
      };
    });

    expect(result.errorTag).toBe("UserCleanupError");
    expect(result.ownerMembership).toMatchObject({
      role: "admin",
      status: "active",
    });
    expect(result.school?.createdBy).toBe(result.ownerMembership?.userId);
  });
});
