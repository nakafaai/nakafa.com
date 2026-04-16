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
      api.assessments.mutations.public.questions.createQuestion,
      {
        schoolId: seeded.schoolId,
        assessmentId,
        sectionId,
        questionType: "essay",
        source: "manual",
        stem: PARAGRAPH,
        points: 5,
        required: true,
        shuffleChoices: false,
        choices: [],
        rubricCriteria: [
          {
            label: "Accuracy",
            description: PARAGRAPH,
            maxScore: 5,
          },
        ],
      }
    );

    await teacherClient.mutation(
      api.assessments.mutations.public.version.createAssessmentVersion,
      {
        schoolId: seeded.schoolId,
        assessmentId,
        timingPolicy: { perSection: false },
        gradingMode: "hybrid",
        monitoringMode: "basic",
        releaseMode: "manual",
        rankingScope: "none",
        retakePolicy: { allowRetake: false },
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
      const [
        assessment,
        versions,
        sections,
        questions,
        versionSections,
        versionQuestions,
        choices,
        versionChoices,
        rubricCriteria,
        versionRubricCriteria,
      ] = await Promise.all([
        ctx.db.get("schoolAssessments", assessmentId),
        ctx.db
          .query("schoolAssessmentVersions")
          .withIndex("by_assessmentId_and_versionNumber", (q) =>
            q.eq("assessmentId", assessmentId)
          )
          .collect(),
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
        ctx.db
          .query("schoolAssessmentVersionSections")
          .withIndex("by_assessmentId_and_versionId_and_order", (q) =>
            q.eq("assessmentId", assessmentId)
          )
          .collect(),
        ctx.db
          .query("schoolAssessmentVersionQuestions")
          .withIndex(
            "by_assessmentId_and_versionId_and_sectionId_and_order",
            (q) => q.eq("assessmentId", assessmentId)
          )
          .collect(),
        ctx.db
          .query("schoolAssessmentChoices")
          .withIndex("by_assessmentId_and_questionId_and_order", (q) =>
            q.eq("assessmentId", assessmentId)
          )
          .collect(),
        ctx.db
          .query("schoolAssessmentVersionChoices")
          .withIndex("by_assessmentId_and_questionId_and_order", (q) =>
            q.eq("assessmentId", assessmentId)
          )
          .collect(),
        ctx.db
          .query("schoolAssessmentRubricCriteria")
          .withIndex("by_assessmentId_and_questionId_and_order", (q) =>
            q.eq("assessmentId", assessmentId)
          )
          .collect(),
        ctx.db
          .query("schoolAssessmentVersionRubricCriteria")
          .withIndex("by_assessmentId_and_questionId_and_order", (q) =>
            q.eq("assessmentId", assessmentId)
          )
          .collect(),
      ]);

      return {
        assessment,
        choices,
        questions,
        rubricCriteria,
        sections,
        versionChoices,
        versionQuestions,
        versionRubricCriteria,
        versionSections,
        versions,
      };
    });

    expect(deletedState.assessment).toBeNull();
    expect(deletedState.choices).toHaveLength(0);
    expect(deletedState.sections).toHaveLength(0);
    expect(deletedState.questions).toHaveLength(0);
    expect(deletedState.rubricCriteria).toHaveLength(0);
    expect(deletedState.versionChoices).toHaveLength(0);
    expect(deletedState.versionQuestions).toHaveLength(0);
    expect(deletedState.versionRubricCriteria).toHaveLength(0);
    expect(deletedState.versionSections).toHaveLength(0);
    expect(deletedState.versions).toHaveLength(0);
  });

  it("cancels the pending publish job before deleting a scheduled assessment", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const teacher = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "scheduled-delete-teacher",
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
        title: "Delete Scheduled Assessment",
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
      api.assessments.mutations.public.delete.deleteAssessment,
      {
        schoolId: seeded.schoolId,
        assessmentId,
      }
    );

    const deletedState = await t.query(async (ctx) => {
      return {
        assessment: await ctx.db.get("schoolAssessments", assessmentId),
        scheduledJob: await ctx.db.system.get(
          "_scheduled_functions",
          scheduledJobId
        ),
      };
    });

    expect(deletedState.assessment).toBeNull();
    expect(deletedState.scheduledJob?.state).toEqual(
      expect.objectContaining({ kind: "canceled" })
    );
  });
});
