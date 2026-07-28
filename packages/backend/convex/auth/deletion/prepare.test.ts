import { prepareAccountDeletion } from "@repo/backend/convex/auth/deletion/prepare";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 6, 28, 8, 0, 0);

describe("auth/deletion/prepare", () => {
  it("allows an account that does not own a school", async () => {
    const t = convexTest(schema, convexModules);

    const isPrepared = await t.mutation((ctx) =>
      runConvexProgram(prepareAccountDeletion(ctx, "missing-auth-user"))
    );

    expect(isPrepared).toBe(true);
  });

  it("leaves an owner-only school and account unchanged", async () => {
    const t = convexTest(schema, convexModules);

    const seeded = await t.mutation(async (ctx) => {
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

      return { ownerId, schoolId };
    });
    const isPrepared = await t.mutation((ctx) =>
      runConvexProgram(prepareAccountDeletion(ctx, "school-owner"))
    );
    const state = await t.query(async (ctx) => ({
      owner: await ctx.db.get("users", seeded.ownerId),
      school: await ctx.db.get("schools", seeded.schoolId),
    }));

    expect(isPrepared).toBe(false);
    expect(state.owner).not.toHaveProperty("deletedAt");
    expect(state.school?.createdBy).toBe(seeded.ownerId);
  });

  it("tombstones the account and transfers ownership atomically", async () => {
    const t = convexTest(schema, convexModules);

    const seeded = await t.mutation(async (ctx) => {
      const ownerId = await ctx.db.insert("users", {
        authId: "transfer-owner",
        credits: 0,
        creditsResetAt: 0,
        email: "owner@example.com",
        name: "School Owner",
        plan: "free",
      });
      const deletingSuccessorId = await ctx.db.insert("users", {
        authId: "deleting-transfer-successor",
        credits: 0,
        creditsResetAt: 0,
        deletedAt: NOW,
        email: "deleting-successor@example.com",
        name: "Deleting Successor",
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
        role: "teacher",
        schoolId,
        status: "active",
        updatedAt: NOW,
        userId: deletingSuccessorId,
      });
      await ctx.db.insert("schoolMembers", {
        joinedAt: NOW,
        role: "student",
        schoolId,
        status: "active",
        updatedAt: NOW,
        userId: successorId,
      });

      return { ownerId, schoolId, successorId };
    });
    const isPrepared = await t.mutation((ctx) =>
      runConvexProgram(prepareAccountDeletion(ctx, "transfer-owner"))
    );
    const state = await t.query(async (ctx) => ({
      owner: await ctx.db.get("users", seeded.ownerId),
      school: await ctx.db.get("schools", seeded.schoolId),
      successorMembership: await ctx.db
        .query("schoolMembers")
        .withIndex("by_schoolId_and_userId_and_status", (query) =>
          query
            .eq("schoolId", seeded.schoolId)
            .eq("userId", seeded.successorId)
            .eq("status", "active")
        )
        .unique(),
    }));

    expect(isPrepared).toBe(true);
    expect(state.owner?.deletedAt).toEqual(expect.any(Number));
    expect(state.school).toMatchObject({
      createdBy: seeded.successorId,
      updatedBy: seeded.successorId,
    });
    expect(state.successorMembership?.role).toBe("admin");
  });

  it("blocks a successor whose account is already being deleted", async () => {
    const t = convexTest(schema, convexModules);

    const ownerId = await t.mutation(async (ctx) => {
      const ownerId = await ctx.db.insert("users", {
        authId: "concurrent-owner",
        credits: 0,
        creditsResetAt: 0,
        email: "owner@example.com",
        name: "School Owner",
        plan: "free",
      });
      const deletingSuccessorId = await ctx.db.insert("users", {
        authId: "concurrent-successor",
        credits: 0,
        creditsResetAt: 0,
        deletedAt: NOW,
        email: "successor@example.com",
        name: "Deleting Successor",
        plan: "free",
      });
      const schoolId = await ctx.db.insert("schools", {
        city: "Jakarta",
        createdBy: ownerId,
        currentStudents: 0,
        currentTeachers: 1,
        email: "school@example.com",
        name: "Concurrent Deletion School",
        province: "DKI Jakarta",
        slug: "concurrent-deletion-school",
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
        userId: deletingSuccessorId,
      });

      return ownerId;
    });
    const isPrepared = await t.mutation((ctx) =>
      runConvexProgram(prepareAccountDeletion(ctx, "concurrent-owner"))
    );
    const owner = await t.query(async (ctx) => await ctx.db.get(ownerId));

    expect(isPrepared).toBe(false);
    expect(owner).not.toHaveProperty("deletedAt");
  });

  it("does not partially transfer schools when one lacks a successor", async () => {
    const t = convexTest(schema, convexModules);

    const seeded = await t.mutation(async (ctx) => {
      const ownerId = await ctx.db.insert("users", {
        authId: "multi-school-owner",
        credits: 0,
        creditsResetAt: 0,
        email: "owner@example.com",
        name: "School Owner",
        plan: "free",
      });
      const successorId = await ctx.db.insert("users", {
        authId: "multi-school-successor",
        credits: 0,
        creditsResetAt: 0,
        email: "successor@example.com",
        name: "Successor",
        plan: "free",
      });
      const transferableSchoolId = await ctx.db.insert("schools", {
        city: "Jakarta",
        createdBy: ownerId,
        currentStudents: 1,
        currentTeachers: 0,
        email: "shared-school@example.com",
        name: "Shared School",
        province: "DKI Jakarta",
        slug: "shared-school-with-blocked-sibling",
        type: "high-school",
        updatedAt: NOW,
      });
      const blockedSchoolId = await ctx.db.insert("schools", {
        city: "Bandung",
        createdBy: ownerId,
        currentStudents: 0,
        currentTeachers: 0,
        email: "owner-only-school@example.com",
        name: "Owner-only School",
        province: "Jawa Barat",
        slug: "owner-only-school-with-shared-sibling",
        type: "high-school",
        updatedAt: NOW,
      });

      for (const schoolId of [transferableSchoolId, blockedSchoolId]) {
        await ctx.db.insert("schoolMembers", {
          joinedAt: NOW,
          role: "admin",
          schoolId,
          status: "active",
          updatedAt: NOW,
          userId: ownerId,
        });
      }

      const successorMembershipId = await ctx.db.insert("schoolMembers", {
        joinedAt: NOW,
        role: "student",
        schoolId: transferableSchoolId,
        status: "active",
        updatedAt: NOW,
        userId: successorId,
      });

      return {
        blockedSchoolId,
        ownerId,
        successorMembershipId,
        transferableSchoolId,
      };
    });
    const isPrepared = await t.mutation((ctx) =>
      runConvexProgram(prepareAccountDeletion(ctx, "multi-school-owner"))
    );
    const state = await t.query(async (ctx) => ({
      blockedSchool: await ctx.db.get("schools", seeded.blockedSchoolId),
      owner: await ctx.db.get("users", seeded.ownerId),
      successorMembership: await ctx.db.get(
        "schoolMembers",
        seeded.successorMembershipId
      ),
      transferableSchool: await ctx.db.get(
        "schools",
        seeded.transferableSchoolId
      ),
    }));

    expect(isPrepared).toBe(false);
    expect(state.owner).not.toHaveProperty("deletedAt");
    expect(state.transferableSchool?.createdBy).toBe(seeded.ownerId);
    expect(state.blockedSchool?.createdBy).toBe(seeded.ownerId);
    expect(state.successorMembership?.role).toBe("student");
  });
});
