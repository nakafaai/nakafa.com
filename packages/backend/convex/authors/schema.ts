import { defineTable } from "convex/server";
import { v } from "convex/values";
import { contentTypeValidator } from "../lib/contentValidators";

const tables = {
  /** Shared author profiles, referenced by multiple content types */
  authors: defineTable({
    /** Unique identifier for author pages and lookups, e.g. "kobilok" */
    username: v.string(),
    /** Display name, e.g. "Nakafa AI" */
    name: v.string(),
    url: v.optional(v.string()),
    twitter: v.optional(v.string()),
    linkedin: v.optional(v.string()),
    github: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  })
    .index("username", ["username"])
    .index("name", ["name"]),

  /**
   * Join table linking content to authors (N:M relationship).
   *
   * Why polymorphic? Single table serves all content types (articles, subjects, exercises)
   * instead of separate articleAuthors, subjectAuthors, etc.
   *
   * @example
   * // Get authors for an article
   * const links = await ctx.db.query("contentAuthors")
   *   .withIndex("contentId_contentType", q =>
   *     q.eq("contentId", article._id).eq("contentType", "article")
   *   ).collect();
   */
  contentAuthors: defineTable({
    /** Document ID from articleContents, subjectContents, or exerciseContents (stored as string for polymorphism) */
    contentId: v.string(),
    /** Discriminator: which table contentId refers to */
    contentType: contentTypeValidator,
    authorId: v.id("authors"),
    /** Author ordering: 0 = primary, 1 = secondary, etc. */
    order: v.number(),
  })
    .index("contentId_contentType", ["contentId", "contentType"])
    .index("authorId", ["authorId"]),
};

export default tables;
