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

describe("assessments/mutations/public/delete", () => {
  it("deletes one authored assessment and its draft tree when no assignments exist", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const teacher = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "delete-teacher",
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
        title: "Delete Me",
        description: PARAGRAPH,
        mode: "assignment",
        status: "draft",
      }
    );

    const sectionId = await teacherClient.mutation(
      api.assessments.mutations.public.sections.createSection,
      {
        schoolId: seeded.schoolId,
        assessmentId,
        title: "Section A",
      }
    );

    await teacherClient.mutation(
      api.assessments.mutations.public.questions.createQuestion,
      {
        schoolId: seeded.schoolId,
        assessmentId,
        sectionId,
        questionType: "mcq-single",
        source: "manual",
        stem: PARAGRAPH,
        points: 10,
        required: true,
        shuffleChoices: false,
        choices: [{ key: "A", content: PARAGRAPH, isCorrect: true }],
        rubricCriteria: [],
      }
    );

    await teacherClient.mutation(
      api.assessments.mutations.public.delete.deleteAssessment,
      {
        schoolId: seeded.schoolId,
        assessmentId,
      }
    );

    const deletedState = await t.query(async (ctx) => {
      const [assessment, sections, questions] = await Promise.all([
        ctx.db.get("schoolAssessments", assessmentId),
        ctx.db
          .query("schoolAssessmentSections")
          .withIndex("by_assessmentId_and_order", (q) =>
            q.eq("assessmentId", assessmentId)
          )
          .collect(),
        ctx.db
          .query("schoolAssessmentQuestions")
          .withIndex("by_assessmentId_and_sectionId_and_order", (q) =>
            q.eq("assessmentId", assessmentId)
          )
          .collect(),
      ]);

      return { assessment, questions, sections };
    });

    expect(deletedState.assessment).toBeNull();
    expect(deletedState.sections).toHaveLength(0);
    expect(deletedState.questions).toHaveLength(0);
  });
});
