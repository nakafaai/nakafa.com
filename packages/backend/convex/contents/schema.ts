import {
  contentIdValidator,
  contentTypeValidator,
  localeValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  contentViews: defineTable({
    // Content reference for statistics tracking
    // Tracks: articles, subject sections, and exercise sets (what users browse)
    contentId: contentIdValidator,
    contentType: contentTypeValidator,
    locale: localeValidator,

    // Existing fields
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
    .index("deviceId_lastViewedAt", ["deviceId", "lastViewedAt"])
    .index("contentId_locale", ["contentId", "locale"])
    .index("contentType_locale", ["contentType", "locale"]),
};

export default tables;
