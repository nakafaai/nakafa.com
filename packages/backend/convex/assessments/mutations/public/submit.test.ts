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

describe("assessments/mutations/public/submit", () => {
  it("creates, versions, publishes, and auto-grades one mcq assessment", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const teacher = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "teacher",
      });
      const student = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "student",
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
        userId: teacher.userId,
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

      return { classId, schoolId, student, teacher };
    });

    const teacherClient = t.withIdentity({
      subject: seeded.teacher.authUserId,
      sessionId: seeded.teacher.sessionId,
    });
    const studentClient = t.withIdentity({
      subject: seeded.student.authUserId,
      sessionId: seeded.student.sessionId,
    });

    const assessmentId = await teacherClient.mutation(
      api.assessments.mutations.public.create.createAssessment,
      {
        schoolId: seeded.schoolId,
        classId: seeded.classId,
        title: "Exam 1",
        description: PARAGRAPH,
        mode: "exam",
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
        choices: [
          { key: "A", content: PARAGRAPH, isCorrect: true },
          {
            key: "B",
            content: {
              ...PARAGRAPH,
              text: "Wrong",
              json: JSON.stringify([
                { type: "p", children: [{ text: "Wrong" }] },
              ]),
            },
            isCorrect: false,
          },
        ],
        rubricCriteria: [],
      }
    );

    const versionId = await teacherClient.mutation(
      api.assessments.mutations.public.version.createAssessmentVersion,
      {
        schoolId: seeded.schoolId,
        assessmentId,
        timingPolicy: { perSection: false },
        gradingMode: "auto",
        monitoringMode: "strict",
        releaseMode: "manual",
        rankingScope: "none",
        retakePolicy: { allowRetake: false },
      }
    );

    const assignmentId = await teacherClient.mutation(
      api.assessments.mutations.public.assign.createAssignment,
      {
        schoolId: seeded.schoolId,
        assessmentId,
        versionId,
        title: "Exam 1 Publish",
        classIds: [seeded.classId],
        timingPolicy: { durationMinutes: 60, perSection: false },
        gradingMode: "auto",
        monitoringMode: "strict",
        releaseMode: "manual",
        rankingScope: "none",
        retakePolicy: { allowRetake: false },
      }
    );

    const assignment = await studentClient.query(
      api.assessments.queries.public.assignment.getAssignment,
      {
        assignmentId,
        classId: seeded.classId,
      }
    );

    const attemptId = await studentClient.mutation(
      api.assessments.mutations.public.start.startAttempt,
      {
        assignmentId,
        classId: seeded.classId,
      }
    );

    const versionQuestion = await t.query(async (ctx) => {
      return await ctx.db
        .query("schoolAssessmentVersionQuestions")
        .withIndex("by_versionId_and_sectionId_and_order", (q) =>
          q.eq("versionId", versionId)
        )
        .first();
    });

    if (!versionQuestion) {
      throw new Error("Expected one version question.");
    }

    const correctChoice = await t.query(async (ctx) => {
      return await ctx.db
        .query("schoolAssessmentVersionChoices")
        .withIndex("by_questionId_and_order", (q) =>
          q.eq("questionId", versionQuestion._id)
        )
        .first();
    });

    if (!correctChoice) {
      throw new Error("Expected one version choice.");
    }

    await studentClient.mutation(
      api.assessments.mutations.public.save.saveResponse,
      {
        attemptId,
        questionId: versionQuestion._id,
        questionType: "mcq-single",
        selectedChoiceIds: [correctChoice._id],
        isFinal: true,
      }
    );

    await studentClient.mutation(
      api.assessments.mutations.public.submit.submitAttempt,
      {
        attemptId,
      }
    );

    const submittedAttempt = await t.query(async (ctx) => {
      return await ctx.db.get("schoolAssessmentAttempts", attemptId);
    });

    expect(assignment.assignment._id).toBe(assignmentId);
    expect(submittedAttempt?.status).toBe("submitted");
    expect(submittedAttempt?.score).toBe(10);
  });
});
