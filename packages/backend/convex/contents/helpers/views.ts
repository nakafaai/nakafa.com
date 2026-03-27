import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getContentAnalyticsPartition } from "@repo/backend/convex/contents/helpers/partitions";
import type {
  ContentRef,
  ContentViewRef,
  Locale,
} from "@repo/backend/convex/lib/validators/contents";
import { ConvexError } from "convex/values";

/** Loads one content reference by localized slug for view recording. */
export async function loadContentRefBySlug(
  db: MutationCtx["db"],
  {
    locale,
    slug,
    type,
  }: {
    locale: Locale;
    slug: Doc<"contentViews">["slug"];
    type: ContentViewRef["type"];
  }
) {
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

      return { type: "article", id: article._id } satisfies ContentRef;
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

      return { type: "subject", id: section._id } satisfies ContentRef;
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

      return { type: "exercise", id: exerciseSet._id } satisfies ContentRef;
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
export async function upsertContentView(
  db: MutationCtx["db"],
  contentRef: ContentRef,
  args: Pick<Doc<"contentViews">, "deviceId" | "locale" | "slug" | "userId">
) {
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
