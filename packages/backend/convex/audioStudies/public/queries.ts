import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { query } from "@repo/backend/convex/_generated/server";
import { audioStatusValidator } from "@repo/backend/convex/lib/validators/audio";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { logger } from "@repo/backend/convex/utils/logger";
import { v } from "convex/values";
import { literals, nullable } from "convex-helpers/validators";

/**
 * Gets audio playback URL and metadata by content slug.
 * Public query - no authentication required.
 *
 * Returns null if content not found or audio not ready.
 *
 * @example
 * const audio = await ctx.runQuery(
 *   api.audioStudies.public.getAudioBySlug,
 *   { slug: "quadratic-equations", locale: "en", contentType: "subject" }
 * );
 */
export const getAudioBySlug = query({
  args: {
    slug: v.string(),
    locale: localeValidator,
    contentType: literals("article", "subject"),
  },
  returns: nullable(
    v.object({
      audioUrl: v.string(),
      duration: v.number(),
      status: audioStatusValidator,
      script: v.optional(v.string()),
      contentType: literals("article", "subject"),
    })
  ),
  handler: async (ctx, args) => {
    // Find content by slug + locale
    let contentId: Id<"articleContents"> | Id<"subjectSections"> | null = null;

    switch (args.contentType) {
      case "article": {
        const article = await ctx.db
          .query("articleContents")
          .withIndex("locale_slug", (q) =>
            q.eq("locale", args.locale).eq("slug", args.slug)
          )
          .first();
        contentId = article?._id ?? null;
        break;
      }
      case "subject": {
        const section = await ctx.db
          .query("subjectSections")
          .withIndex("locale_slug", (q) =>
            q.eq("locale", args.locale).eq("slug", args.slug)
          )
          .first();
        contentId = section?._id ?? null;
        break;
      }
      default: {
        return null;
      }
    }

    if (!contentId) {
      logger.debug("Content not found", {
        slug: args.slug,
        locale: args.locale,
        contentType: args.contentType,
      });
      return null;
    }

    // Query audio record
    const audio = await ctx.db
      .query("contentAudios")
      .withIndex("contentRef_locale", (q) =>
        q
          .eq("contentRef.type", args.contentType)
          .eq("contentRef.id", contentId)
          .eq("locale", args.locale)
      )
      .first();

    if (!audio) {
      logger.debug("Audio not found", {
        slug: args.slug,
        locale: args.locale,
      });
      return null;
    }

    // Only return completed audio
    if (audio.status !== "completed" || !audio.audioStorageId) {
      logger.debug("Audio not ready", {
        slug: args.slug,
        status: audio.status,
      });
      return null;
    }

    // Generate storage URL (expires in 1 hour)
    const audioUrl = await ctx.storage.getUrl(audio.audioStorageId);

    if (!audioUrl) {
      logger.warn("Storage URL failed", {
        slug: args.slug,
        storageId: audio.audioStorageId,
      });
      return null;
    }

    // Convert milliseconds to seconds for API response
    // Database stores milliseconds for precision, but API returns seconds for compatibility
    const durationSec = audio.audioDuration ? audio.audioDuration / 1000 : 0;

    logger.info("Audio served", {
      slug: args.slug,
      locale: args.locale,
      durationMs: audio.audioDuration,
      durationSec: durationSec.toFixed(3),
    });

    return {
      audioUrl,
      duration: durationSec,
      status: audio.status,
      script: audio.script,
      contentType: args.contentType,
    };
  },
});
