import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 3, 14, 12, 0, 0);

/** Insert one school row with the minimum fields required by the schema. */
async function insertSchool(ctx: MutationCtx, userId: Id<"users">) {
  return await ctx.db.insert("schools", {
    name: "Nakafa School",
    slug: "nakafa-school",
    email: "school@example.com",
    city: "Jakarta",
    province: "DKI Jakarta",
    type: "high-school",
    currentStudents: 0,
    currentTeachers: 0,
    updatedAt: NOW,
    createdBy: userId,
    updatedBy: userId,
  });
}

/** Insert one class row with the minimum fields required by the schema. */
async function insertClass(
  ctx: MutationCtx,
  schoolId: Id<"schools">,
  userId: Id<"users">
) {
  return await ctx.db.insert("schoolClasses", {
    schoolId,
    name: "Class 10A",
    subject: "Mathematics",
    year: "2026/2027",
    image: "retro",
    isArchived: false,
    visibility: "public",
    studentCount: 0,
    teacherCount: 0,
    updatedAt: NOW,
    createdBy: userId,
    updatedBy: userId,
  });
}

describe("classes/queries:getClassRoute", () => {
  it("returns the accessible route snapshot for class members", async () => {
    vi.setSystemTime(new Date(NOW));
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const viewer = await seedAuthenticatedUser(ctx, { now: NOW });
      const schoolId = await insertSchool(ctx, viewer.userId);

      await ctx.db.insert("schoolMembers", {
        schoolId,
        userId: viewer.userId,
        role: "teacher",
        status: "active",
        joinedAt: NOW,
        updatedAt: NOW,
      });

      const classId = await insertClass(ctx, schoolId, viewer.userId);

      await ctx.db.insert("schoolClassMembers", {
        classId,
        schoolId,
        userId: viewer.userId,
        role: "teacher",
        teacherRole: "primary",
        updatedAt: NOW,
      });

      return { ...viewer, classId };
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.classes.queries.getClassRoute, { classId: identity.classId });

    expect(result.kind).toBe("accessible");

    if (result.kind !== "accessible") {
      throw new Error("Expected an accessible class route snapshot.");
    }

    expect(result.class._id).toBe(identity.classId);
    expect(result.classMembership?.role).toBe("teacher");
    expect(result.schoolMembership.role).toBe("teacher");
  });

  it("returns the join screen snapshot for school members outside the class", async () => {
    vi.setSystemTime(new Date(NOW));
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const teacher = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "teacher",
      });
      const student = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "student",
      });
      const schoolId = await insertSchool(ctx, teacher.userId);

      await ctx.db.insert("schoolMembers", {
        schoolId,
        userId: teacher.userId,
        role: "teacher",
        status: "active",
        joinedAt: NOW,
        updatedAt: NOW,
      });

      await ctx.db.insert("schoolMembers", {
        schoolId,
        userId: student.userId,
        role: "student",
        status: "active",
        joinedAt: NOW,
        updatedAt: NOW,
      });

      const classId = await insertClass(ctx, schoolId, teacher.userId);

      await ctx.db.insert("schoolClassMembers", {
        classId,
        schoolId,
        userId: teacher.userId,
        role: "teacher",
        teacherRole: "primary",
        updatedAt: NOW,
      });

      return { ...student, classId };
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.classes.queries.getClassRoute, { classId: identity.classId });

    expect(result).toEqual({
      kind: "joinRequired",
      class: expect.objectContaining({
        _id: identity.classId,
        name: "Class 10A",
        visibility: "public",
      }),
      schoolMembership: expect.objectContaining({
        role: "student",
      }),
    });
  });
});
