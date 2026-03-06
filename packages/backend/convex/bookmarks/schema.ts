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
  }),
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
  }),
};

export default tables;
