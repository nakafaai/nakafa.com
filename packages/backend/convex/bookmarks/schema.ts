import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  bookmarks: defineTable({
    slug: v.string(),
    userId: v.id("users"),
    collectionId: v.optional(v.id("bookmarkCollections")),
    note: v.optional(v.string()),
    order: v.number(),
    bookmarkedAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("userId_collectionId", ["userId", "collectionId"])
    .index("userId_slug", ["userId", "slug"]),
  bookmarkCollections: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    userId: v.id("users"),
    bookmarkCount: v.number(),
    isDefault: v.boolean(),
    isPublic: v.boolean(),
    emoji: v.optional(v.string()),
    image: v.string(), // auto random pick from a list of images as default
    order: v.number(),
    updatedAt: v.number(),
  })
    .index("userId", ["userId"])
    .index("userId_isPublic", ["userId", "isPublic"])
    .index("userId_isDefault", ["userId", "isDefault"]),
};

export default tables;
