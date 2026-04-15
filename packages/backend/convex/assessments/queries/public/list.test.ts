import { api } from "@repo/backend/convex/_generated/api";
import {
  insertClass,
  insertSchool,
  NOW,
  PARAGRAPH,
} from "@repo/backend/convex/assessments/seed";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { describe, expect, it, vi } from "vitest";

describe("assessments/queries/public/list", () => {
  it("allows a class teacher to list class-scoped assessments", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const admin = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "list-admin",
      });
      const teacher = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "list-teacher",
      });
      const schoolId = await insertSchool(ctx, admin.userId);
      const classId = await insertClass(ctx, schoolId, admin.userId);

      await ctx.db.insert("schoolMembers", {
        schoolId,
        userId: admin.userId,
        role: "admin",
        status: "active",
        joinedAt: NOW,
        updatedAt: NOW,
      });
      await ctx.db.insert("schoolMembers", {
        schoolId,
        userId: teacher.userId,
        role: "teacher",
        status: "active",
        joinedAt: NOW,
        updatedAt: NOW,
      });
      await ctx.db.insert("schoolClassMembers", {
        classId,
        schoolId,
        userId: teacher.userId,
        role: "teacher",
        updatedAt: NOW,
      });

      return { admin, classId, schoolId, teacher };
    });

    const adminClient = t.withIdentity({
      subject: seeded.admin.authUserId,
      sessionId: seeded.admin.sessionId,
    });
    const teacherClient = t.withIdentity({
      subject: seeded.teacher.authUserId,
      sessionId: seeded.teacher.sessionId,
    });

    await adminClient.mutation(
      api.assessments.mutations.public.create.createAssessment,
      {
        schoolId: seeded.schoolId,
        classId: seeded.classId,
        title: "Class Assessment",
        description: PARAGRAPH,
        mode: "assignment",
        status: "draft",
      }
    );

    const assessments = await teacherClient.query(
      api.assessments.queries.public.list.listAssessments,
      {
        schoolId: seeded.schoolId,
        classId: seeded.classId,
        paginationOpts: { cursor: null, numItems: 20 },
      }
    );

    expect(assessments.page).toHaveLength(1);
    expect(assessments.page[0]?.title).toBe("Class Assessment");
  });

  it("only returns published assessments to students", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const admin = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "student-list-admin",
      });
      const student = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "student-list-student",
      });
      const schoolId = await insertSchool(ctx, admin.userId);
      const classId = await insertClass(ctx, schoolId, admin.userId);

      await ctx.db.insert("schoolMembers", {
        schoolId,
        userId: admin.userId,
        role: "admin",
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
      await ctx.db.insert("schoolClassMembers", {
        classId,
        schoolId,
        userId: admin.userId,
        role: "teacher",
        teacherRole: "primary",
        updatedAt: NOW,
      });
      await ctx.db.insert("schoolClassMembers", {
        classId,
        schoolId,
        userId: student.userId,
        role: "student",
        updatedAt: NOW,
      });

      return { admin, classId, schoolId, student };
    });

    const adminClient = t.withIdentity({
      subject: seeded.admin.authUserId,
      sessionId: seeded.admin.sessionId,
    });
    const studentClient = t.withIdentity({
      subject: seeded.student.authUserId,
      sessionId: seeded.student.sessionId,
    });

    const publishedAssessmentId = await adminClient.mutation(
      api.assessments.mutations.public.create.createAssessment,
      {
        schoolId: seeded.schoolId,
        classId: seeded.classId,
        title: "Published Assessment",
        description: PARAGRAPH,
        mode: "assignment",
        status: "draft",
      }
    );

    await adminClient.mutation(
      api.assessments.mutations.public.update.updateAssessment,
      {
        schoolId: seeded.schoolId,
        assessmentId: publishedAssessmentId,
        status: "published",
      }
    );

    await adminClient.mutation(
      api.assessments.mutations.public.create.createAssessment,
      {
        schoolId: seeded.schoolId,
        classId: seeded.classId,
        title: "Draft Assessment",
        description: PARAGRAPH,
        mode: "assignment",
        status: "draft",
      }
    );

    const archivedAssessmentId = await adminClient.mutation(
      api.assessments.mutations.public.create.createAssessment,
      {
        schoolId: seeded.schoolId,
        classId: seeded.classId,
        title: "Archived Assessment",
        description: PARAGRAPH,
        mode: "assignment",
        status: "draft",
      }
    );

    await adminClient.mutation(
      api.assessments.mutations.public.update.updateAssessment,
      {
        schoolId: seeded.schoolId,
        assessmentId: archivedAssessmentId,
        status: "archived",
      }
    );

    const assessments = await studentClient.query(
      api.assessments.queries.public.list.listAssessments,
      {
        schoolId: seeded.schoolId,
        classId: seeded.classId,
        paginationOpts: { cursor: null, numItems: 20 },
      }
    );

    expect(assessments.page).toHaveLength(1);
    expect(assessments.page[0]?.title).toBe("Published Assessment");
    expect(assessments.page[0]?.status).toBe("published");
  });
});
