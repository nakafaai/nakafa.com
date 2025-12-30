import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  contentViews: defineTable({
    slug: v.string(),
    deviceId: v.string(),
    userId: v.optional(v.id("users")),
    firstViewedAt: v.number(),
    lastViewedAt: v.number(),
    viewCount: v.number(),
    totalDurationSeconds: v.number(),
    isIncognito: v.boolean(),
  })
    .index("userId_slug", ["userId", "slug"])
    .index("deviceId_slug", ["deviceId", "slug"])
    .index("userId_lastViewedAt", ["userId", "lastViewedAt"])
    .index("deviceId_lastViewedAt", ["deviceId", "lastViewedAt"]),
  contentStats: defineTable({
    userId: v.id("users"),
    totalViewCount: v.number(),
    totalUniqueContent: v.number(),
    totalDurationSeconds: v.number(),
    lastViewedAt: v.number(),
    updatedAt: v.number(),
  }).index("userId", ["userId"]),
};

export default tables;
