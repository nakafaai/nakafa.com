import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
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
  if (type === "article") {
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

  if (type === "subject") {
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

/** Upserts the durable content view row from one sealed view event. */
export async function upsertContentViewFromEvent(
  db: MutationCtx["db"],
  args: Pick<
    Doc<"contentViewEvents">,
    "contentRef" | "deviceId" | "locale" | "slug" | "userId" | "viewedAt"
  >
) {
  const existingByDevice = await db
    .query("contentViews")
    .withIndex("by_deviceId_and_contentRefId", (q) =>
      q.eq("deviceId", args.deviceId).eq("contentRef.id", args.contentRef.id)
    )
    .first();

  const existingByUser = args.userId
    ? await db
        .query("contentViews")
        .withIndex("by_userId_and_contentRefId", (q) =>
          q.eq("userId", args.userId).eq("contentRef.id", args.contentRef.id)
        )
        .first()
    : null;
  const existingView = existingByUser ?? existingByDevice;

  if (!existingView) {
    await db.insert("contentViews", {
      contentRef: args.contentRef,
      locale: args.locale,
      slug: args.slug,
      deviceId: args.deviceId,
      userId: args.userId,
      firstViewedAt: args.viewedAt,
      lastViewedAt: args.viewedAt,
    });

    return { success: true, isNewView: true, alreadyViewed: false };
  }

  if (existingByUser) {
    await db.patch("contentViews", existingByUser._id, {
      lastViewedAt: args.viewedAt,
    });

    return { success: true, isNewView: false, alreadyViewed: true };
  }

  if (!existingView.userId && args.userId) {
    await db.patch("contentViews", existingView._id, {
      lastViewedAt: args.viewedAt,
      userId: args.userId,
    });

    return { success: true, isNewView: false, alreadyViewed: true };
  }

  await db.patch("contentViews", existingView._id, {
    lastViewedAt: args.viewedAt,
  });

  return { success: true, isNewView: false, alreadyViewed: true };
}
