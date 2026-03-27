import { query } from "@repo/backend/convex/_generated/server";
import { audioStatusValidator } from "@repo/backend/convex/lib/validators/audio";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { logger } from "@repo/backend/convex/utils/logger";
import { v } from "convex/values";
import { literals, nullable } from "convex-helpers/validators";

/**
 * Gets audio playback URL and metadata by content slug.
 * Public query - no authentication required.
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
    if (args.contentType === "article") {
      const article = await ctx.db
        .query("articleContents")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", args.locale).eq("slug", args.slug)
        )
        .first();

      if (!article) {
        logger.debug("Content not found", {
          slug: args.slug,
          locale: args.locale,
          contentType: args.contentType,
        });
        return null;
      }

      const audio = await ctx.db
        .query("contentAudios")
        .withIndex("by_contentRefType_and_contentRefId_and_locale", (q) =>
          q
            .eq("contentRef.type", args.contentType)
            .eq("contentRef.id", article._id)
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

      if (audio.status !== "completed" || !audio.audioStorageId) {
        logger.debug("Audio not ready", {
          slug: args.slug,
          status: audio.status,
        });
        return null;
      }

      const audioUrl = await ctx.storage.getUrl(audio.audioStorageId);

      if (!audioUrl) {
        logger.warn("Storage URL failed", {
          slug: args.slug,
          storageId: audio.audioStorageId,
        });
        return null;
      }

      const duration = audio.audioDuration ? audio.audioDuration / 1000 : 0;

      logger.info("Audio served", {
        slug: args.slug,
        locale: args.locale,
        durationMs: audio.audioDuration,
        durationSec: duration.toFixed(3),
      });

      return {
        audioUrl,
        duration,
        status: audio.status,
        script: audio.script,
        contentType: args.contentType,
      };
    }

    const section = await ctx.db
      .query("subjectSections")
      .withIndex("by_locale_and_slug", (q) =>
        q.eq("locale", args.locale).eq("slug", args.slug)
      )
      .first();

    if (!section) {
      logger.debug("Content not found", {
        slug: args.slug,
        locale: args.locale,
        contentType: args.contentType,
      });
      return null;
    }

    const audio = await ctx.db
      .query("contentAudios")
      .withIndex("by_contentRefType_and_contentRefId_and_locale", (q) =>
        q
          .eq("contentRef.type", args.contentType)
          .eq("contentRef.id", section._id)
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

    if (audio.status !== "completed" || !audio.audioStorageId) {
      logger.debug("Audio not ready", {
        slug: args.slug,
        status: audio.status,
      });
      return null;
    }

    const audioUrl = await ctx.storage.getUrl(audio.audioStorageId);

    if (!audioUrl) {
      logger.warn("Storage URL failed", {
        slug: args.slug,
        storageId: audio.audioStorageId,
      });
      return null;
    }

    const duration = audio.audioDuration ? audio.audioDuration / 1000 : 0;

    logger.info("Audio served", {
      slug: args.slug,
      locale: args.locale,
      durationMs: audio.audioDuration,
      durationSec: duration.toFixed(3),
    });

    return {
      audioUrl,
      duration,
      status: audio.status,
      script: audio.script,
      contentType: args.contentType,
    };
  },
});
