import { afterEach, assert, describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { schoolClassMembersHandler } from "@repo/backend/convex/triggers/schools/classMembers";
import { createClassFixture } from "@repo/backend/test/classes";

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

it("records role transitions with exact optional teacher metadata and tolerates removed invites", async () => {
  const { t, users, classId, schoolId } = await createClassFixture();
  await t.mutation(async (ctx) => {
    const invite = await ctx.db.query("schoolClassInviteCodes").first();
    assert(invite);
    await ctx.db.delete("schoolClassInviteCodes", invite._id);
    const id = await ctx.db.insert("schoolClassMembers", {
      classId,
      schoolId,
      userId: users.outsider.userId,
      role: "student",
      updatedAt: 0,
      inviteCodeId: invite._id,
    });
    const student = await ctx.db.get("schoolClassMembers", id);
    assert(student);
    await schoolClassMembersHandler(ctx, {
      id,
      operation: "insert",
      oldDoc: null,
      newDoc: student,
    });
    const teacher = {
      ...student,
      role: "teacher",
      teacherRole: "assistant",
    } as const;
    await schoolClassMembersHandler(ctx, {
      id,
      operation: "update",
      oldDoc: student,
      newDoc: teacher,
    });
    await schoolClassMembersHandler(ctx, {
      id,
      operation: "update",
      oldDoc: teacher,
      newDoc: teacher,
    });
    await schoolClassMembersHandler(ctx, {
      id,
      operation: "update",
      oldDoc: teacher,
      newDoc: student,
    });
    await schoolClassMembersHandler(ctx, {
      id,
      operation: "delete",
      oldDoc: { ...student, removedBy: users.admin.userId },
      newDoc: null,
    });
  });
  const state = await t.query(async (ctx) => ({
    classroom: await ctx.db.get("schoolClasses", classId),
    logs: await ctx.db.query("schoolActivityLogs").collect(),
  }));
  expect(state.classroom).toMatchObject({ studentCount: 0, teacherCount: 1 });
  const change = state.logs.find(
    (row) =>
      row.metadata &&
      "newTeacherRole" in row.metadata &&
      row.metadata.newTeacherRole === "assistant"
  );
  expect(change?.metadata).toStrictEqual({
    classId,
    newTeacherRole: "assistant",
  });
  expect(state.logs).toContainEqual(
    expect.objectContaining({
      action: "class_member_removed",
      userId: users.admin.userId,
    })
  );
});
