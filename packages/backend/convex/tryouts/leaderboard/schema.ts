import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/route";
import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  tryoutLeaderboardScopes: defineTable({
    countryKey: tryoutRouteKeyValidator,
    examKey: tryoutRouteKeyValidator,
    setKey: v.optional(tryoutRouteKeyValidator),
    locale: localeValidator,
    sourceRevision: v.string(),
    syncedAt: v.number(),
  }).index("by_countryKey_and_examKey_and_setKey_and_locale", [
    "countryKey",
    "examKey",
    "setKey",
    "locale",
  ]),

  tryoutLeaderboardUserStats: defineTable({
    userId: v.id("users"),
    leaderboardScopeId: v.id("tryoutLeaderboardScopes"),
    totalTryoutsCompleted: v.number(),
    averageScore: v.number(),
    bestScore: v.number(),
    averageRawScore: v.number(),
    lastTryoutAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId_and_leaderboardScopeId", [
    "userId",
    "leaderboardScopeId",
  ]),

  tryoutLeaderboardEntries: defineTable({
    tryoutSetId: v.id("tryoutSets"),
    userId: v.id("users"),
    leaderboardScopeId: v.id("tryoutLeaderboardScopes"),
    publishedScore: v.number(),
    theta: v.optional(v.number()),
    thetaSE: v.optional(v.number()),
    rawScore: v.number(),
    completedAt: v.number(),
    attemptId: v.id("tryoutAttempts"),
  })
    .index("by_tryoutSetId_and_userId", ["tryoutSetId", "userId"])
    .index("by_userId_and_leaderboardScopeId_and_completedAt", [
      "userId",
      "leaderboardScopeId",
      "completedAt",
    ])
    .index("by_leaderboardScopeId_and_publishedScore", [
      "leaderboardScopeId",
      "publishedScore",
    ]),
};

export default tables;
