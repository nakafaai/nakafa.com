import { api, internal } from "@repo/backend/convex/_generated/api";
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

describe("assessments/mutations/internal/publishing", () => {
  it("clears schedule fields when a scheduled assessment is published", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const teacher = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "scheduled-publish-teacher",
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

    vi.setSystemTime(new Date(NOW + 1000));

    await t.mutation(async (ctx) => {
      await ctx.runMutation(
        internal.assessments.mutations.internal.publishing.publishAssessment,
        {
          assessmentId,
          publishedBy: seeded.teacher.userId,
        }
      );
    });

    const assessment = await t.query(async (ctx) => {
      return await ctx.db.get("schoolAssessments", assessmentId);
    });

    expect(assessment?.status).toBe("published");
    expect(assessment?.scheduledAt).toBeUndefined();
    expect(assessment?.scheduledJobId).toBeUndefined();
    expect(assessment?.publishedAt).toBe(NOW + 1000);
    expect(assessment?.publishedBy).toBe(seeded.teacher.userId);
  });
});
