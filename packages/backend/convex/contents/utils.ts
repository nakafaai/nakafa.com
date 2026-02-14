import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { ConvexError } from "convex/values";

/**
 * Rate limiting window in milliseconds.
 * Prevents view count spam by limiting views per device/user per content.
 * Current: 1 minute between view increments.
 */
const RATE_LIMIT_MS = 60_000;

/**
 * Common arguments for recording a content view.
 */
interface RecordViewArgs {
  locale: Locale;
  slug: string;
  deviceId: string;
  userId?: Id<"users">;
  durationSeconds?: number;
}

/**
 * Result of recording a content view.
 */
interface RecordViewResult {
  success: boolean;
  isNewView: boolean;
  rateLimited?: boolean;
}

/**
 * Record a view for an article content.
 *
 * @param ctx - Convex mutation context
 * @param contentId - Article content ID
 * @param args - View record arguments
 * @returns Result indicating if view was recorded and if it was new
 */
async function recordArticleView(
  ctx: MutationCtx,
  contentId: Id<"articleContents">,
  args: RecordViewArgs
): Promise<RecordViewResult> {
  const now = Date.now();

  const existingView = args.userId
    ? await ctx.db
        .query("articleContentViews")
        .withIndex("userId_slug", (q) =>
          q.eq("userId", args.userId).eq("slug", args.slug)
        )
        .first()
    : await ctx.db
        .query("articleContentViews")
        .withIndex("deviceId_slug", (q) =>
          q.eq("deviceId", args.deviceId).eq("slug", args.slug)
        )
        .first();

  if (existingView) {
    // Rate limiting: Check if last view was within the rate limit window
    const timeSinceLastView = now - existingView.lastViewedAt;
    if (timeSinceLastView < RATE_LIMIT_MS) {
      return { success: false, isNewView: false, rateLimited: true };
    }

    await ctx.db.patch(existingView._id, {
      viewCount: existingView.viewCount + 1,
      lastViewedAt: now,
      totalDurationSeconds:
        existingView.totalDurationSeconds + (args.durationSeconds ?? 0),
    });
    return { success: true, isNewView: false };
  }

  await ctx.db.insert("articleContentViews", {
    contentId,
    locale: args.locale,
    slug: args.slug,
    deviceId: args.deviceId,
    userId: args.userId,
    firstViewedAt: now,
    lastViewedAt: now,
    viewCount: 1,
    totalDurationSeconds: args.durationSeconds ?? 0,
    isIncognito: !args.userId,
  });

  return { success: true, isNewView: true };
}

/**
 * Record a view for a subject section.
 *
 * @param ctx - Convex mutation context
 * @param contentId - Subject section ID
 * @param args - View record arguments
 * @returns Result indicating if view was recorded and if it was new
 */
async function recordSubjectView(
  ctx: MutationCtx,
  contentId: Id<"subjectSections">,
  args: RecordViewArgs
): Promise<RecordViewResult> {
  const now = Date.now();

  const existingView = args.userId
    ? await ctx.db
        .query("subjectContentViews")
        .withIndex("userId_slug", (q) =>
          q.eq("userId", args.userId).eq("slug", args.slug)
        )
        .first()
    : await ctx.db
        .query("subjectContentViews")
        .withIndex("deviceId_slug", (q) =>
          q.eq("deviceId", args.deviceId).eq("slug", args.slug)
        )
        .first();

  if (existingView) {
    // Rate limiting: Check if last view was within the rate limit window
    const timeSinceLastView = now - existingView.lastViewedAt;
    if (timeSinceLastView < RATE_LIMIT_MS) {
      return { success: false, isNewView: false, rateLimited: true };
    }

    await ctx.db.patch(existingView._id, {
      viewCount: existingView.viewCount + 1,
      lastViewedAt: now,
      totalDurationSeconds:
        existingView.totalDurationSeconds + (args.durationSeconds ?? 0),
    });
    return { success: true, isNewView: false };
  }

  await ctx.db.insert("subjectContentViews", {
    contentId,
    locale: args.locale,
    slug: args.slug,
    deviceId: args.deviceId,
    userId: args.userId,
    firstViewedAt: now,
    lastViewedAt: now,
    viewCount: 1,
    totalDurationSeconds: args.durationSeconds ?? 0,
    isIncognito: !args.userId,
  });

  return { success: true, isNewView: true };
}

/**
 * Record a view for an exercise set.
 *
 * @param ctx - Convex mutation context
 * @param contentId - Exercise set ID
 * @param args - View record arguments
 * @returns Result indicating if view was recorded and if it was new
 */
async function recordExerciseView(
  ctx: MutationCtx,
  contentId: Id<"exerciseSets">,
  args: RecordViewArgs
): Promise<RecordViewResult> {
  const now = Date.now();

  const existingView = args.userId
    ? await ctx.db
        .query("exerciseContentViews")
        .withIndex("userId_slug", (q) =>
          q.eq("userId", args.userId).eq("slug", args.slug)
        )
        .first()
    : await ctx.db
        .query("exerciseContentViews")
        .withIndex("deviceId_slug", (q) =>
          q.eq("deviceId", args.deviceId).eq("slug", args.slug)
        )
        .first();

  if (existingView) {
    // Rate limiting: Check if last view was within the rate limit window
    const timeSinceLastView = now - existingView.lastViewedAt;
    if (timeSinceLastView < RATE_LIMIT_MS) {
      return { success: false, isNewView: false, rateLimited: true };
    }

    await ctx.db.patch(existingView._id, {
      viewCount: existingView.viewCount + 1,
      lastViewedAt: now,
      totalDurationSeconds:
        existingView.totalDurationSeconds + (args.durationSeconds ?? 0),
    });
    return { success: true, isNewView: false };
  }

  await ctx.db.insert("exerciseContentViews", {
    contentId,
    locale: args.locale,
    slug: args.slug,
    deviceId: args.deviceId,
    userId: args.userId,
    firstViewedAt: now,
    lastViewedAt: now,
    viewCount: 1,
    totalDurationSeconds: args.durationSeconds ?? 0,
    isIncognito: !args.userId,
  });

  return { success: true, isNewView: true };
}

/**
 * Record a content view after looking up the content by slug.
 *
 * This helper eliminates duplication across content type-specific mutations
 * by handling the common view recording logic.
 *
 * Design:
 * - Each content type has its own dedicated function for type safety
 * - No type assertions needed - TypeScript narrows types automatically
 * - Follows the pattern established in audioStudies/utils.ts
 *
 * @param ctx - Convex mutation context
 * @param type - Content type discriminator
 * @param locale - Content locale
 * @param slug - Content slug for lookup
 * @param args - View record arguments (deviceId, userId, durationSeconds)
 * @returns Result indicating if view was recorded and if it was new
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
