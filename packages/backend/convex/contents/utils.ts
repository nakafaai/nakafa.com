import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type {
  ContentRef,
  Locale,
} from "@repo/backend/convex/lib/validators/contents";
import { ConvexError } from "convex/values";

interface RecordViewArgs {
  locale: Locale;
  slug: string;
  deviceId: string;
  userId?: Id<"users">;
}

interface RecordViewResult {
  success: boolean;
  isNewView: boolean;
  alreadyViewed: boolean;
}

/**
 * Records a unique content view per user/device.
 * Returns alreadyViewed=true if previously viewed.
 */
async function recordView(
  ctx: MutationCtx,
  contentRef: ContentRef,
  args: RecordViewArgs
): Promise<RecordViewResult> {
  const now = Date.now();

  const existingView = args.userId
    ? await ctx.db
        .query("contentViews")
        .withIndex("userId_contentRefId", (q) =>
          q.eq("userId", args.userId).eq("contentRef.id", contentRef.id)
        )
        .first()
    : await ctx.db
        .query("contentViews")
        .withIndex("deviceId_contentRefId", (q) =>
          q.eq("deviceId", args.deviceId).eq("contentRef.id", contentRef.id)
        )
        .first();

  if (existingView) {
    return { success: true, isNewView: false, alreadyViewed: true };
  }

  await ctx.db.insert("contentViews", {
    contentRef,
    locale: args.locale,
    slug: args.slug,
    deviceId: args.deviceId,
    userId: args.userId,
    viewedAt: now,
  });

  return { success: true, isNewView: true, alreadyViewed: false };
}

/**
 * Records a content view by slug.
 * Looks up content by slug, then records view by ID.
 * Throws ConvexError if content not found.
 */
export async function recordContentViewBySlug(
  ctx: MutationCtx,
  type: "article" | "subject" | "exercise",
  locale: Locale,
  slug: string,
  args: Omit<RecordViewArgs, "locale" | "slug">
): Promise<RecordViewResult> {
  const viewArgs: RecordViewArgs = {
    locale,
    slug,
    ...args,
  };

  switch (type) {
    case "article": {
      const article = await ctx.db
        .query("articleContents")
        .withIndex("locale_slug", (q) =>
          q.eq("locale", locale).eq("slug", slug)
        )
        .first();

      if (!article) {
        throw new ConvexError({
          code: "CONTENT_NOT_FOUND",
          message: `Article not found: ${locale}/${slug}`,
        });
      }

      return recordView(ctx, { type: "article", id: article._id }, viewArgs);
    }

    case "subject": {
      const section = await ctx.db
        .query("subjectSections")
        .withIndex("locale_slug", (q) =>
          q.eq("locale", locale).eq("slug", slug)
        )
        .first();

      if (!section) {
        throw new ConvexError({
          code: "CONTENT_NOT_FOUND",
          message: `Subject section not found: ${locale}/${slug}`,
        });
      }

      return recordView(ctx, { type: "subject", id: section._id }, viewArgs);
    }

    case "exercise": {
      const exerciseSet = await ctx.db
        .query("exerciseSets")
        .withIndex("locale_slug", (q) =>
          q.eq("locale", locale).eq("slug", slug)
        )
        .first();

      if (!exerciseSet) {
        throw new ConvexError({
          code: "CONTENT_NOT_FOUND",
          message: `Exercise set not found: ${locale}/${slug}`,
        });
      }

      return recordView(
        ctx,
        { type: "exercise", id: exerciseSet._id },
        viewArgs
      );
    }

    default: {
      throw new ConvexError({
        code: "INVALID_CONTENT_TYPE",
        message: "Invalid content type",
      });
    }
  }
}
