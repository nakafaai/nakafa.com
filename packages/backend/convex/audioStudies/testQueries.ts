import { internalQuery } from "@repo/backend/convex/_generated/server";
import { audioModelValidator } from "@repo/backend/convex/lib/validators/audio";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";

/**
 * List recent articles for testing audio generation.
 * Returns article ID, title, and slug for easy selection.
 */
export const listRecentArticles = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: vv.id("articleContents"),
      title: v.string(),
      slug: v.string(),
      locale: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const articles = await ctx.db
      .query("articleContents")
      .order("desc")
      .take(args.limit ?? 10);

    return articles.map((article) => ({
      _id: article._id,
      title: article.title,
      slug: article.slug,
      locale: article.locale,
    }));
  },
});

/**
 * List recent subject sections for testing audio generation.
 * Returns section ID, title, and slug for easy selection.
 */
export const listRecentSubjectSections = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: vv.id("subjectSections"),
      title: v.string(),
      slug: v.string(),
      locale: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const sections = await ctx.db
      .query("subjectSections")
      .order("desc")
      .take(args.limit ?? 10);

    return sections.map((section) => ({
      _id: section._id,
      title: section.title,
      slug: section.slug,
      locale: section.locale,
    }));
  },
});

/**
 * Get audio generation status for testing.
 * Returns status, script preview, and error if any.
 */
export const getTestAudioStatus = internalQuery({
  args: {
    contentAudioId: vv.id("contentAudios"),
  },
  returns: v.object({
    status: v.string(),
    script: v.optional(v.string()),
    error: v.optional(v.string()),
    hasAudio: v.boolean(),
    model: v.optional(audioModelValidator),
  }),
  handler: async (ctx, args) => {
    const audio = await ctx.db.get(args.contentAudioId);

    if (!audio) {
      return {
        status: "not_found",
        error: "Audio record not found",
        hasAudio: false,
      };
    }

    return {
      status: audio.status,
      script: audio.script,
      error: audio.errorMessage,
      hasAudio: !!audio.audioStorageId,
      model: audio.model,
    };
  },
});
