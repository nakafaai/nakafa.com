import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getContentAnalyticsPartition } from "@repo/backend/convex/contents/helpers/partitions";
import type { ContentRef } from "@repo/backend/convex/lib/validators/contents";
import {
  contentTypeValidator,
  localeValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { ConvexError, type Infer, v } from "convex/values";

type ContentViewsDb = MutationCtx["db"];

const recordContentViewBySlugArgsValidator = v.object({
  deviceId: v.string(),
  locale: localeValidator,
  slug: v.string(),
  type: contentTypeValidator,
  userId: v.optional(v.id("users")),
});

type RecordContentViewBySlugArgs = Infer<
  typeof recordContentViewBySlugArgsValidator
>;

const recordContentViewResultValidator = v.object({
  alreadyViewed: v.boolean(),
  isNewView: v.boolean(),
  success: v.boolean(),
});

/** Result returned after recording one content view. */
export type RecordContentViewResult = Infer<
  typeof recordContentViewResultValidator
>;

/** Loads one content reference by localized slug for view recording. */
async function loadContentRefBySlug(
  db: ContentViewsDb,
  {
    locale,
    slug,
    type,
  }: Pick<RecordContentViewBySlugArgs, "locale" | "slug" | "type">
): Promise<ContentRef> {
  switch (type) {
    case "article": {
      const article = await db
        .query("articleContents")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", locale).eq("slug", slug)
        )
        .first();

      if (!article) {
        throw new ConvexError({
          code: "CONTENT_NOT_FOUND",
          message: `Article not found: ${locale}/${slug}`,
        });
      }

      return { type: "article", id: article._id };
    }

    case "subject": {
      const section = await db
        .query("subjectSections")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", locale).eq("slug", slug)
        )
        .first();

      if (!section) {
        throw new ConvexError({
          code: "CONTENT_NOT_FOUND",
          message: `Subject section not found: ${locale}/${slug}`,
        });
      }

      return { type: "subject", id: section._id };
    }

    case "exercise": {
      const exerciseSet = await db
        .query("exerciseSets")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", locale).eq("slug", slug)
        )
        .first();

      if (!exerciseSet) {
        throw new ConvexError({
          code: "CONTENT_NOT_FOUND",
          message: `Exercise set not found: ${locale}/${slug}`,
        });
      }

      return { type: "exercise", id: exerciseSet._id };
    }

    default: {
      throw new ConvexError({
        code: "INVALID_CONTENT_TYPE",
        message: "Invalid content type.",
      });
    }
  }
}

/** Upserts the durable content view row and queues first-view analytics. */
async function upsertContentView(
  db: ContentViewsDb,
  contentRef: ContentRef,
  args: Omit<RecordContentViewBySlugArgs, "type">
): Promise<RecordContentViewResult> {
  const now = Date.now();
  const existingByDevice = await db
    .query("contentViews")
    .withIndex("by_deviceId_and_contentRefId", (q) =>
      q.eq("deviceId", args.deviceId).eq("contentRef.id", contentRef.id)
    )
    .first();

  const existingByUser = args.userId
    ? await db
        .query("contentViews")
        .withIndex("by_userId_and_contentRefId", (q) =>
          q.eq("userId", args.userId).eq("contentRef.id", contentRef.id)
        )
        .first()
    : null;

  const existingView = existingByDevice ?? existingByUser;

  if (!existingView) {
    const partition = getContentAnalyticsPartition(contentRef);

    await db.insert("contentViews", {
      contentRef,
      locale: args.locale,
      slug: args.slug,
      deviceId: args.deviceId,
      userId: args.userId,
      firstViewedAt: now,
      lastViewedAt: now,
    });

    await db.insert("contentViewAnalyticsQueue", {
      contentRef,
      locale: args.locale,
      partition,
      viewedAt: now,
    });

    return { success: true, isNewView: true, alreadyViewed: false };
  }

  await db.patch("contentViews", existingView._id, {
    lastViewedAt: now,
  });

  return { success: true, isNewView: false, alreadyViewed: true };
}

/**
 * Records one content view by localized slug.
 * Throws when the localized content record does not exist.
 */
export async function recordContentViewBySlug(
  ctx: Pick<MutationCtx, "db">,
  { deviceId, locale, slug, type, userId }: RecordContentViewBySlugArgs
): Promise<RecordContentViewResult> {
  const contentRef = await loadContentRefBySlug(ctx.db, {
    locale,
    slug,
    type,
  });

  return upsertContentView(ctx.db, contentRef, {
    deviceId,
    locale,
    slug,
    userId,
  });
}
