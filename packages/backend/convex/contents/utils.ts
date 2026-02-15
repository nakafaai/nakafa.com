import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
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
 * Records a unique view per user/device per content.
 *
 * Convex Best Practice - Idempotent Mutations:
 * Same inputs always produce the same output. If view already exists,
 * returns success without modifying data. Prevents inflated view counts.
 *
 * Tracking Strategy:
 * - Logged-in users: Tracked by userId (1 view per account)
 * - Anonymous users: Tracked by deviceId (1 view per device/browser)
 * - No time limits: Once viewed, always counted as viewed
 */
async function recordArticleView(
  ctx: MutationCtx,
  contentId: Id<"articleContents">,
  args: RecordViewArgs
): Promise<RecordViewResult> {
  const now = Date.now();

  // Check for existing view by userId (logged in) or deviceId (anonymous)
  const existingView = args.userId
    ? await ctx.db
        .query("articleContentViews")
        .withIndex("userId_contentId", (q) =>
          q.eq("userId", args.userId).eq("contentId", contentId)
        )
        .first()
    : await ctx.db
        .query("articleContentViews")
        .withIndex("deviceId_contentId", (q) =>
          q.eq("deviceId", args.deviceId).eq("contentId", contentId)
        )
        .first();

  // Idempotent: If already viewed, return without modification
  // This ensures 1 view = 1 person forever (no inflation)
  if (existingView) {
    // Optionally update lastViewedAt for analytics, but don't increment count
    await ctx.db.patch("articleContentViews", existingView._id, {
      lastViewedAt: now,
    });
    return { success: true, isNewView: false, alreadyViewed: true };
  }

  // First view from this user/device - create record
  // Each record represents exactly 1 unique view
  await ctx.db.insert("articleContentViews", {
    contentId,
    locale: args.locale,
    slug: args.slug,
    deviceId: args.deviceId,
    userId: args.userId,
    firstViewedAt: now,
    lastViewedAt: now,
  });

  return { success: true, isNewView: true, alreadyViewed: false };
}

async function recordSubjectView(
  ctx: MutationCtx,
  contentId: Id<"subjectSections">,
  args: RecordViewArgs
): Promise<RecordViewResult> {
  const now = Date.now();

  const existingView = args.userId
    ? await ctx.db
        .query("subjectContentViews")
        .withIndex("userId_contentId", (q) =>
          q.eq("userId", args.userId).eq("contentId", contentId)
        )
        .first()
    : await ctx.db
        .query("subjectContentViews")
        .withIndex("deviceId_contentId", (q) =>
          q.eq("deviceId", args.deviceId).eq("contentId", contentId)
        )
        .first();

  if (existingView) {
    await ctx.db.patch("subjectContentViews", existingView._id, {
      lastViewedAt: now,
    });
    return { success: true, isNewView: false, alreadyViewed: true };
  }

  await ctx.db.insert("subjectContentViews", {
    contentId,
    locale: args.locale,
    slug: args.slug,
    deviceId: args.deviceId,
    userId: args.userId,
    firstViewedAt: now,
    lastViewedAt: now,
  });

  return { success: true, isNewView: true, alreadyViewed: false };
}

async function recordExerciseView(
  ctx: MutationCtx,
  contentId: Id<"exerciseSets">,
  args: RecordViewArgs
): Promise<RecordViewResult> {
  const now = Date.now();

  const existingView = args.userId
    ? await ctx.db
        .query("exerciseContentViews")
        .withIndex("userId_contentId", (q) =>
          q.eq("userId", args.userId).eq("contentId", contentId)
        )
        .first()
    : await ctx.db
        .query("exerciseContentViews")
        .withIndex("deviceId_contentId", (q) =>
          q.eq("deviceId", args.deviceId).eq("contentId", contentId)
        )
        .first();

  if (existingView) {
    await ctx.db.patch("exerciseContentViews", existingView._id, {
      lastViewedAt: now,
    });
    return { success: true, isNewView: false, alreadyViewed: true };
  }

  await ctx.db.insert("exerciseContentViews", {
    contentId,
    locale: args.locale,
    slug: args.slug,
    deviceId: args.deviceId,
    userId: args.userId,
    firstViewedAt: now,
    lastViewedAt: now,
  });

  return { success: true, isNewView: true, alreadyViewed: false };
}

/**
 * Records a unique content view per user/device.
 *
 * Idempotent Operation: Same user/device viewing same content multiple times
 * will only count as 1 view. This ensures accurate view counts without inflation.
 *
 * @throws ConvexError if content not found
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

      return recordArticleView(ctx, article._id, viewArgs);
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

      return recordSubjectView(ctx, section._id, viewArgs);
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

      return recordExerciseView(ctx, exerciseSet._id, viewArgs);
    }

    default: {
      throw new ConvexError({
        code: "INVALID_CONTENT_TYPE",
        message: "Invalid content type",
      });
    }
  }
}
