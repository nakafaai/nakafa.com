import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type {
  ContentRef,
  ContentType,
  Locale,
} from "@repo/backend/convex/lib/validators/contents";
import { ConvexError } from "convex/values";

type ContentViewsDb = MutationCtx["db"];

interface RecordContentViewArgs {
  deviceId: string;
  locale: Locale;
  slug: string;
  userId?: Id<"users">;
}

export interface RecordContentViewResult {
  alreadyViewed: boolean;
  isNewView: boolean;
  success: boolean;
}

/** Loads one content reference by localized slug for view recording. */
async function loadContentRefBySlug(
  db: ContentViewsDb,
  {
    locale,
    slug,
    type,
  }: {
    locale: Locale;
    slug: string;
    type: ContentType;
  }
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

/** Writes the durable content view row and queues first-view analytics. */
async function writeContentView(
  db: ContentViewsDb,
  contentRef: ContentRef,
  args: RecordContentViewArgs
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
      viewedAt: now,
    });

    return { success: true, isNewView: true, alreadyViewed: false };
  }

  await db.patch("contentViews", existingView._id, {
    lastViewedAt: now,
  });

  return { success: true, isNewView: false, alreadyViewed: true };
}

/** Records one content view by localized slug. */
export async function recordContentViewBySlug(
  ctx: Pick<MutationCtx, "db">,
  {
    deviceId,
    locale,
    slug,
    type,
    userId,
  }: {
    deviceId: string;
    locale: Locale;
    slug: string;
    type: ContentType;
    userId?: Id<"users">;
  }
): Promise<RecordContentViewResult> {
  const contentRef = await loadContentRefBySlug(ctx.db, {
    locale,
    slug,
    type,
  });

  return writeContentView(ctx.db, contentRef, {
    deviceId,
    locale,
    slug,
    userId,
  });
}
