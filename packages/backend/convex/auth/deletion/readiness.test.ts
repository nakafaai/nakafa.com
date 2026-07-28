import { getSchoolOwnershipDeletionReadiness } from "@repo/backend/convex/auth/deletion/readiness";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 6, 28, 8, 0, 0);

describe("auth/deletion/readiness", () => {
  it("allows an account that does not own a school", async () => {
    const t = convexTest(schema, convexModules);

    const isReady = await t.query((ctx) =>
      runConvexProgram(
        getSchoolOwnershipDeletionReadiness(ctx, "missing-auth-user")
      )
    );

    expect(isReady).toBe(true);
  });

  it("blocks an owner-only school", async () => {
    const t = convexTest(schema, convexModules);

    const isReady = await t.mutation(async (ctx) => {
      const ownerId = await ctx.db.insert("users", {
        authId: "school-owner",
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
      await ctx.db.insert("schoolMembers", {
        joinedAt: NOW,
        role: "admin",
        schoolId,
        status: "active",
        updatedAt: NOW,
        userId: ownerId,
      });

      return await runConvexProgram(
        getSchoolOwnershipDeletionReadiness(ctx, "school-owner")
      );
    });

    expect(isReady).toBe(false);
  });

  it("allows ownership transfer to another active member", async () => {
    const t = convexTest(schema, convexModules);

    const isReady = await t.mutation(async (ctx) => {
      const ownerId = await ctx.db.insert("users", {
        authId: "transfer-owner",
        credits: 0,
        creditsResetAt: 0,
        email: "owner@example.com",
        name: "School Owner",
        plan: "free",
      });
      const successorId = await ctx.db.insert("users", {
        authId: "transfer-successor",
        credits: 0,
        creditsResetAt: 0,
        email: "successor@example.com",
        name: "Successor",
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
        role: "student",
        schoolId,
        status: "active",
        updatedAt: NOW,
        userId: successorId,
      });

      return await runConvexProgram(
        getSchoolOwnershipDeletionReadiness(ctx, "transfer-owner")
      );
    });

    expect(isReady).toBe(true);
  });
});
