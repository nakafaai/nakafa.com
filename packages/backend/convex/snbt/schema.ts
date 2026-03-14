import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

export const snbtTryoutStatusValidator = literals(
  "in-progress",
  "completed",
  "expired",
  "abandoned"
);

const tables = {
  snbtTryouts: defineTable({
    locale: localeValidator,
    year: v.number(),
    slug: v.string(),
    setName: v.string(),
    subjectCount: v.number(),
    questionCountPerSubject: v.number(),
    totalQuestionCount: v.number(),
    isActive: v.boolean(),
    detectedAt: v.number(),
    syncedAt: v.number(),
  })
    .index("locale_slug", ["locale", "slug"])
    .index("locale_year_slug", ["locale", "year", "slug"])
    .index("locale_isActive", ["locale", "isActive"]),

  snbtTryoutSets: defineTable({
    tryoutId: v.id("snbtTryouts"),
    setId: v.id("exerciseSets"),
    subjectIndex: v.number(),
  }).index("tryoutId_subjectIndex", ["tryoutId", "subjectIndex"]),

  snbtTryoutAttempts: defineTable({
    userId: v.id("users"),
    tryoutId: v.id("snbtTryouts"),
    scaleVersionId: v.id("irtScaleVersions"),
    status: snbtTryoutStatusValidator,
    completedSubjectIndices: v.array(v.number()),
    totalCorrect: v.number(),
    totalQuestions: v.number(),
    theta: v.number(),
    thetaSE: v.number(),
    irtScore: v.number(),
    startedAt: v.number(),
    lastActivityAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("userId_tryoutId", ["userId", "tryoutId"])
    .index("userId_tryoutId_status_startedAt", [
      "userId",
      "tryoutId",
      "status",
      "startedAt",
    ]),

  snbtTryoutSubjectAttempts: defineTable({
    tryoutAttemptId: v.id("snbtTryoutAttempts"),
    subjectIndex: v.number(),
    setAttemptId: v.id("exerciseAttempts"),
    setId: v.id("exerciseSets"),
    theta: v.number(),
    thetaSE: v.number(),
  })
    .index("tryoutAttemptId_subjectIndex", ["tryoutAttemptId", "subjectIndex"])
    .index("setAttemptId", ["setAttemptId"]),

  userSnbtStats: defineTable({
    userId: v.id("users"),
    locale: localeValidator,
    totalTryoutsCompleted: v.number(),
    averageTheta: v.number(),
    averageThetaSE: v.number(),
    bestTheta: v.number(),
    averageRawScore: v.number(),
    bestRawScore: v.number(),
    lastTryoutAt: v.number(),
    updatedAt: v.number(),
  }).index("userId_locale", ["userId", "locale"]),

  snbtLeaderboard: defineTable({
    tryoutId: v.id("snbtTryouts"),
    userId: v.id("users"),
    theta: v.number(),
    irtScore: v.number(),
    rawScore: v.number(),
    completedAt: v.number(),
    attemptId: v.id("snbtTryoutAttempts"),
  }).index("tryoutId_userId", ["tryoutId", "userId"]),
};

export default tables;
