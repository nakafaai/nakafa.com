import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { afterEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 4, 29, 21, 0, 0);

describe("triggers/schools/classMembers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps class member counts and invite usage in sync through class mutations", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const users = await t.mutation(async (ctx) => ({
      admin: await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "class-admin",
      }),
      student: await seedAuthenticatedUser(ctx, {
        now: NOW,
        sessionToken: "session-class-student",
        suffix: "class-student",
      }),
    }));
    const admin = t.withIdentity({
      sessionId: users.admin.sessionId,
      subject: users.admin.authUserId,
    });
    const student = t.withIdentity({
      sessionId: users.student.sessionId,
      subject: users.student.authUserId,
    });

    const created = await admin.mutation(api.schools.mutations.createSchool, {
      address: "Jl. Kelas 1",
      city: "Jakarta",
      email: "class-trigger@example.com",
      name: "Class Trigger School",
      phone: "021-654321",
      province: "DKI Jakarta",
      type: "high-school",
    });
    const schoolInviteCode = await t.query(async (ctx) => {
      const inviteCodes = await ctx.db.query("schoolInviteCodes").collect();
      return (
        inviteCodes.find(
          (code) =>
            code.schoolId === created.schoolId && code.role === "student"
        ) ?? null
      );
    });

    if (!schoolInviteCode) {
      throw new Error("Student school invite code was not created.");
    }

    await student.mutation(api.schools.mutations.joinSchool, {
      code: schoolInviteCode.code,
    });

    const classId = await admin.mutation(api.classes.mutations.createClass, {
      name: "Class 10A",
      schoolId: created.schoolId,
      subject: "Mathematics",
      visibility: "public",
      year: "2026/2027",
    });
    const classInviteCode = await t.query(async (ctx) => {
      const inviteCodes = await ctx.db
        .query("schoolClassInviteCodes")
        .collect();
      return (
        inviteCodes.find(
          (code) => code.classId === classId && code.role === "student"
        ) ?? null
      );
    });

    expect(classInviteCode).toMatchObject({
      currentUsage: 0,
      role: "student",
    });
    if (!classInviteCode) {
      throw new Error("Student class invite code was not created.");
    }

    await student.mutation(api.classes.mutations.joinClass, {
      code: classInviteCode.code,
    });

    const state = await t.query(async (ctx) => {
      const logs = await ctx.db
        .query("schoolActivityLogs")
        .withIndex("by_schoolId", (q) => q.eq("schoolId", created.schoolId))
        .collect();

      return {
        classDoc: await ctx.db.get("schoolClasses", classId),
        classInviteCode: await ctx.db.get(
          "schoolClassInviteCodes",
          classInviteCode._id
        ),
        logs,
      };
    });

    expect(state.classDoc).toMatchObject({
      studentCount: 1,
      teacherCount: 1,
    });
    expect(state.classInviteCode).toMatchObject({ currentUsage: 1 });
    expect(state.logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "class_created",
          entityId: classId,
          entityType: "schoolClasses",
          userId: users.admin.userId,
        }),
        expect.objectContaining({
          action: "class_member_added",
          entityType: "schoolClassMembers",
          metadata: expect.objectContaining({
            classId,
            role: "teacher",
          }),
          userId: users.admin.userId,
        }),
        expect.objectContaining({
          action: "class_member_added",
          entityType: "schoolClassMembers",
          metadata: expect.objectContaining({
            classId,
            role: "student",
          }),
          userId: users.student.userId,
        }),
      ])
    );
  });
});
