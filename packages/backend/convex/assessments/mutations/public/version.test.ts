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

describe("assessments/mutations/public/version", () => {
  it("sets publish metadata when versioning a draft assessment", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const teacher = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "version-draft-teacher",
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
        title: "Draft Assessment",
        description: PARAGRAPH,
        mode: "assignment",
        status: "draft",
      }
    );

    const versionId = await teacherClient.mutation(
      api.assessments.mutations.public.version.createAssessmentVersion,
      {
        schoolId: seeded.schoolId,
        assessmentId,
        timingPolicy: { perSection: false },
        gradingMode: "auto",
        monitoringMode: "basic",
        releaseMode: "manual",
        rankingScope: "none",
        retakePolicy: { allowRetake: false },
      }
    );

    const assessment = await t.query(async (ctx) => {
      return await ctx.db.get("schoolAssessments", assessmentId);
    });

    expect(assessment?.currentVersionId).toBe(versionId);
    expect(assessment?.status).toBe("published");
    expect(assessment?.publishedAt).toBe(NOW);
    expect(assessment?.publishedBy).toBe(seeded.teacher.userId);
    expect(assessment?.scheduledAt).toBeUndefined();
    expect(assessment?.scheduledJobId).toBeUndefined();
  });

  it("cancels the pending publish job when versioning a scheduled assessment", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const teacher = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "version-scheduled-teacher",
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
        title: "Scheduled Assessment",
        description: PARAGRAPH,
        mode: "assignment",
        status: "scheduled",
        scheduledAt: NOW + 60_000,
      }
    );

    const scheduledJobId = await t.query(async (ctx) => {
      const assessment = await ctx.db.get("schoolAssessments", assessmentId);

      return assessment?.scheduledJobId;
    });

    if (!scheduledJobId) {
      throw new Error("Expected scheduled assessment job id.");
    }

    await teacherClient.mutation(
      api.assessments.mutations.public.version.createAssessmentVersion,
      {
        schoolId: seeded.schoolId,
        assessmentId,
        timingPolicy: { perSection: false },
        gradingMode: "auto",
        monitoringMode: "basic",
        releaseMode: "manual",
        rankingScope: "none",
        retakePolicy: { allowRetake: false },
      }
    );

    const state = await t.query(async (ctx) => {
      return {
        assessment: await ctx.db.get("schoolAssessments", assessmentId),
        scheduledJob: await ctx.db.system.get(
          "_scheduled_functions",
          scheduledJobId
        ),
      };
    });

    expect(state.assessment?.status).toBe("published");
    expect(state.assessment?.scheduledAt).toBeUndefined();
    expect(state.assessment?.scheduledJobId).toBeUndefined();
    expect(state.scheduledJob?.state).toEqual(
      expect.objectContaining({ kind: "canceled" })
    );
  });

  it("preserves existing publish metadata when versioning an already published assessment", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const teacher = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "version-published-teacher",
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
        title: "Published Assessment",
        description: PARAGRAPH,
        mode: "assignment",
        status: "published",
      }
    );

    const originalAssessment = await t.query(async (ctx) => {
      return await ctx.db.get("schoolAssessments", assessmentId);
    });

    vi.setSystemTime(new Date(NOW + 60_000));

    await teacherClient.mutation(
      api.assessments.mutations.public.version.createAssessmentVersion,
      {
        schoolId: seeded.schoolId,
        assessmentId,
        timingPolicy: { perSection: false },
        gradingMode: "auto",
        monitoringMode: "basic",
        releaseMode: "manual",
        rankingScope: "none",
        retakePolicy: { allowRetake: false },
      }
    );

    const assessment = await t.query(async (ctx) => {
      return await ctx.db.get("schoolAssessments", assessmentId);
    });

    expect(originalAssessment?.publishedAt).toBe(NOW);
    expect(assessment?.publishedAt).toBe(originalAssessment?.publishedAt);
    expect(assessment?.publishedBy).toBe(originalAssessment?.publishedBy);
  });
});
