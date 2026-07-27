import {
  insertClass,
  insertSchool,
  NOW,
  PARAGRAPH,
} from "@repo/backend/convex/assessments/seed";
import { cleanupUserAssessmentData } from "@repo/backend/convex/auth/cleanup/assessments";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("auth cleanup assessments", () => {
  it("deletes assessment runtime, results, imports, and stored files", async () => {
    const t = convexTest(schema, convexModules);

    const state = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "assessment-cleanup-user",
        credits: 10,
        creditsResetAt: NOW,
        email: "assessment-cleanup@example.com",
        name: "Assessment Cleanup",
        plan: "free",
      });
      const schoolId = await insertSchool(ctx, userId);
      const classId = await insertClass(ctx, schoolId, userId);
      const assessmentId = await ctx.db.insert("schoolAssessments", {
        schoolId,
        classId,
        title: "Cleanup assessment",
        slug: "cleanup-assessment",
        order: 0,
        mode: "exam",
        status: "published",
        questionBankScope: "class",
        createdBy: userId,
        updatedAt: NOW,
      });
      const sectionId = await ctx.db.insert("schoolAssessmentSections", {
        schoolId,
        assessmentId,
        title: "Section",
        order: 0,
      });
      const questionId = await ctx.db.insert("schoolAssessmentQuestions", {
        schoolId,
        assessmentId,
        sectionId,
        questionType: "essay",
        source: "manual",
        stem: PARAGRAPH,
        order: 0,
        points: 10,
        required: true,
        shuffleChoices: false,
        rubricCriterionCount: 0,
        choiceCount: 0,
      });
      const versionId = await ctx.db.insert("schoolAssessmentVersions", {
        schoolId,
        assessmentId,
        versionNumber: 1,
        title: "Cleanup assessment",
        mode: "exam",
        timingPolicy: { perSection: false },
        gradingMode: "manual",
        monitoringMode: "basic",
        releaseMode: "manual",
        rankingScope: "class",
        retakePolicy: { allowRetake: false },
        totalPoints: 10,
        totalQuestionCount: 1,
        createdBy: userId,
        createdAt: NOW,
      });
      const versionSectionId = await ctx.db.insert(
        "schoolAssessmentVersionSections",
        {
          schoolId,
          assessmentId,
          versionId,
          sourceSectionId: sectionId,
          title: "Section",
          order: 0,
          questionCount: 1,
          totalPoints: 10,
        }
      );
      const versionQuestionId = await ctx.db.insert(
        "schoolAssessmentVersionQuestions",
        {
          schoolId,
          assessmentId,
          versionId,
          sourceQuestionId: questionId,
          sectionId: versionSectionId,
          questionType: "essay",
          source: "manual",
          stem: PARAGRAPH,
          order: 0,
          points: 10,
          required: true,
          shuffleChoices: false,
          rubricCriterionCount: 0,
          choiceCount: 0,
        }
      );
      const assignmentId = await ctx.db.insert("schoolAssessmentAssignments", {
        schoolId,
        assessmentId,
        versionId,
        title: "Cleanup assignment",
        status: "published",
        timingPolicy: { perSection: false },
        gradingMode: "manual",
        monitoringMode: "basic",
        releaseMode: "manual",
        rankingScope: "class",
        retakePolicy: { allowRetake: false },
        createdBy: userId,
        updatedAt: NOW,
      });
      const targetId = await ctx.db.insert(
        "schoolAssessmentAssignmentTargets",
        {
          schoolId,
          classId,
          assignmentId,
        }
      );
      const attemptId = await ctx.db.insert("schoolAssessmentAttempts", {
        schoolId,
        classId,
        assignmentId,
        targetId,
        assessmentId,
        versionId,
        studentId: userId,
        status: "submitted",
        gradingStatus: "awaiting-manual-review",
        attemptNumber: 1,
        startedAt: NOW,
        submittedAt: NOW,
      });
      const answerStorageId = await ctx.storage.store(
        new Blob(["answer attachment"])
      );
      const responseId = await ctx.db.insert("schoolAssessmentResponses", {
        schoolId,
        classId,
        assignmentId,
        attemptId,
        questionId: versionQuestionId,
        questionType: "essay",
        essayContent: PARAGRAPH,
        essayAttachmentStorageIds: [answerStorageId],
        isFinal: true,
        submittedAt: NOW,
      });

      await ctx.db.insert("schoolAssessmentEssayGrades", {
        schoolId,
        classId,
        assignmentId,
        attemptId,
        responseId,
        questionId: versionQuestionId,
        criterionGrades: [],
        overallScore: 8,
        gradedBy: userId,
        gradedAt: NOW,
      });
      await ctx.db.insert("schoolAssessmentSectionAttempts", {
        schoolId,
        classId,
        attemptId,
        sectionId: versionSectionId,
        submittedAt: NOW,
      });
      await ctx.db.insert("schoolAssessmentAttemptSessions", {
        schoolId,
        classId,
        assignmentId,
        attemptId,
        studentId: userId,
        status: "submitted",
        lastSeenAt: NOW,
        blurCount: 0,
        reconnectCount: 0,
        fullscreenExitCount: 0,
      });
      await ctx.db.insert("schoolAssessmentAttemptEvents", {
        schoolId,
        classId,
        assignmentId,
        attemptId,
        studentId: userId,
        eventType: "submit",
        occurredAt: NOW,
      });
      await ctx.db.insert("schoolAssessmentFlags", {
        schoolId,
        classId,
        assignmentId,
        attemptId,
        studentId: userId,
        severity: "low",
        reviewStatus: "open",
        reason: "Cleanup test",
        createdAt: NOW,
      });
      await ctx.db.insert("schoolAssessmentFinalGrades", {
        schoolId,
        classId,
        assignmentId,
        attemptId,
        studentId: userId,
        score: 8,
        releasedAt: NOW,
        releasedBy: userId,
      });
      await ctx.db.insert("schoolAssessmentStudentStats", {
        schoolId,
        classId,
        assignmentId,
        studentId: userId,
        score: 8,
        submittedAt: NOW,
      });
      await ctx.db.insert("schoolAssessmentLeaderboardEntries", {
        schoolId,
        classId,
        assignmentId,
        studentId: userId,
        score: 8,
        rank: 1,
        rankingScope: "class",
      });

      const importStorageId = await ctx.storage.store(
        new Blob(["assessment import"])
      );
      const importJobId = await ctx.db.insert("schoolAssessmentImportJobs", {
        schoolId,
        classId,
        assessmentId,
        status: "completed",
        sourceName: "cleanup.pdf",
        sourceStorageId: importStorageId,
        createdBy: userId,
        updatedAt: NOW,
      });
      await ctx.db.insert("schoolAssessmentImportDrafts", {
        schoolId,
        classId,
        importJobId,
        questionType: "essay",
        stem: PARAGRAPH,
        points: 10,
        choiceDrafts: [],
        rubricDrafts: [],
        importedAt: NOW,
      });

      await runConvexProgram(cleanupUserAssessmentData(ctx, userId));
      await runConvexProgram(cleanupUserAssessmentData(ctx, userId));
      const hasMore = await runConvexProgram(
        cleanupUserAssessmentData(ctx, userId)
      );

      return {
        answerFile: await ctx.storage.getUrl(answerStorageId),
        attempts: await ctx.db.query("schoolAssessmentAttempts").collect(),
        events: await ctx.db.query("schoolAssessmentAttemptEvents").collect(),
        finalGrades: await ctx.db
          .query("schoolAssessmentFinalGrades")
          .collect(),
        flags: await ctx.db.query("schoolAssessmentFlags").collect(),
        hasMore,
        importDrafts: await ctx.db
          .query("schoolAssessmentImportDrafts")
          .collect(),
        importFile: await ctx.storage.getUrl(importStorageId),
        importJobs: await ctx.db.query("schoolAssessmentImportJobs").collect(),
        leaderboard: await ctx.db
          .query("schoolAssessmentLeaderboardEntries")
          .collect(),
        responses: await ctx.db.query("schoolAssessmentResponses").collect(),
        sessions: await ctx.db
          .query("schoolAssessmentAttemptSessions")
          .collect(),
        stats: await ctx.db.query("schoolAssessmentStudentStats").collect(),
      };
    });

    expect(state).toEqual({
      answerFile: null,
      attempts: [],
      events: [],
      finalGrades: [],
      flags: [],
      hasMore: false,
      importDrafts: [],
      importFile: null,
      importJobs: [],
      leaderboard: [],
      responses: [],
      sessions: [],
      stats: [],
    });
  });
});
