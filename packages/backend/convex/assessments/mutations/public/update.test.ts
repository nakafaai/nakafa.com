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

describe("assessments/mutations/public/update", () => {
  it("updates authored assessment title and mode", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const teacher = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "update-teacher",
      });
      const schoolId = await insertSchool(ctx, teacher.userId);
      const classId = await insertClass(ctx, schoolId, teacher.userId);

      await ctx.db.insert("schoolMembers", {
        schoolId,
        userId: teacher.userId,
        role: "admin",
        status: "active",
        joinedAt: NOW,
        updatedAt: NOW,
      });

      return { classId, schoolId, teacher };
    });

    const teacherClient = t.withIdentity({
      subject: seeded.teacher.authUserId,
      sessionId: seeded.teacher.sessionId,
    });

    const assessmentId = await teacherClient.mutation(
      api.assessments.mutations.public.create.createAssessment,
      {
        schoolId: seeded.schoolId,
        classId: seeded.classId,
        title: "Assessment 1",
        description: PARAGRAPH,
        mode: "assignment",
        status: "draft",
      }
    );

    await teacherClient.mutation(
      api.assessments.mutations.public.update.updateAssessment,
      {
        schoolId: seeded.schoolId,
        assessmentId,
        title: "Updated Assessment",
        mode: "tryout",
      }
    );

    const updatedAssessment = await t.query(async (ctx) => {
      return await ctx.db.get("schoolAssessments", assessmentId);
    });

    expect(updatedAssessment?.title).toBe("Updated Assessment");
    expect(updatedAssessment?.mode).toBe("tryout");
  });

  it("still allows updating an archived assessment", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const teacher = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "archive-teacher",
      });
      const schoolId = await insertSchool(ctx, teacher.userId);
      const classId = await insertClass(ctx, schoolId, teacher.userId);

      await ctx.db.insert("schoolMembers", {
        schoolId,
        userId: teacher.userId,
        role: "admin",
        status: "active",
        joinedAt: NOW,
        updatedAt: NOW,
      });

      return { classId, schoolId, teacher };
    });

    const teacherClient = t.withIdentity({
      subject: seeded.teacher.authUserId,
      sessionId: seeded.teacher.sessionId,
    });

    const assessmentId = await teacherClient.mutation(
      api.assessments.mutations.public.create.createAssessment,
      {
        schoolId: seeded.schoolId,
        classId: seeded.classId,
        title: "Archive Me",
        description: PARAGRAPH,
        mode: "assignment",
        status: "draft",
      }
    );

    await teacherClient.mutation(
      api.assessments.mutations.public.update.updateAssessment,
      {
        schoolId: seeded.schoolId,
        assessmentId,
        status: "archived",
      }
    );

    await teacherClient.mutation(
      api.assessments.mutations.public.update.updateAssessment,
      {
        schoolId: seeded.schoolId,
        assessmentId,
        title: "Archive Me Again",
        status: "draft",
      }
    );

    const updatedAssessment = await t.query(async (ctx) => {
      return await ctx.db.get("schoolAssessments", assessmentId);
    });

    expect(updatedAssessment?.title).toBe("Archive Me Again");
    expect(updatedAssessment?.status).toBe("draft");
  });
});
