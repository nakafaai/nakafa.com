import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { CONTENT_ANALYTICS_PARTITION_COUNT } from "@repo/backend/confect/modules/content/constants";
import type {
  ContentRef,
  ContentViewRef,
  Locale,
} from "@repo/backend/confect/modules/content/content.schemas";
import { getOptionalAppUser } from "@repo/backend/confect/modules/identity/auth/session.service";
import { Clock, Duration, Effect, Option, Schema } from "effect";

const DEFAULT_RECENTLY_VIEWED_LIMIT = 5;

export class ContentViewNotFound extends Schema.TaggedError<ContentViewNotFound>()(
  "ContentViewNotFound",
  { message: Schema.String }
) {}

/** Returns a stable analytics partition for a content reference. */
export function getContentAnalyticsPartition(contentRef: ContentRef) {
  let partition = 0;
  const partitionKey = `${contentRef.type}:${contentRef.id}`;

  for (const character of partitionKey) {
    partition =
      (partition * 31 + character.charCodeAt(0)) %
      CONTENT_ANALYTICS_PARTITION_COUNT;
  }

  return partition;
}

/** Resolves a public content slug into its persisted content reference. */
const loadContentRefBySlug = Effect.fn("contentViews.loadContentRefBySlug")(
  function* (args: { contentRef: ContentViewRef; locale: Locale }) {
    const reader = yield* DatabaseReader;

    if (args.contentRef.type === "subject") {
      const sectionOption = yield* reader
        .table("subjectSections")
        .index("by_locale_and_slug", (query) =>
          query.eq("locale", args.locale).eq("slug", args.contentRef.slug)
        )
        .first();
      const section = Option.getOrNull(sectionOption);

      if (!section) {
        return yield* Effect.fail(
          new ContentViewNotFound({
            message: `Subject section not found: ${args.locale}/${args.contentRef.slug}`,
          })
        );
      }

      return { id: section._id, type: "subject" as const };
    }

    if (args.contentRef.type === "exercise") {
      const exerciseSetOption = yield* reader
        .table("exerciseSets")
        .index("by_locale_and_slug", (query) =>
          query.eq("locale", args.locale).eq("slug", args.contentRef.slug)
        )
        .first();
      const exerciseSet = Option.getOrNull(exerciseSetOption);

      if (!exerciseSet) {
        return yield* Effect.fail(
          new ContentViewNotFound({
            message: `Exercise set not found: ${args.locale}/${args.contentRef.slug}`,
          })
        );
      }

      return { id: exerciseSet._id, type: "exercise" as const };
    }

    const articleOption = yield* reader
      .table("articleContents")
      .index("by_locale_and_slug", (query) =>
        query.eq("locale", args.locale).eq("slug", args.contentRef.slug)
      )
      .first();
    const article = Option.getOrNull(articleOption);

    if (!article) {
      return yield* Effect.fail(
        new ContentViewNotFound({
          message: `Article not found: ${args.locale}/${args.contentRef.slug}`,
        })
      );
    }

    return { id: article._id, type: "article" as const };
  }
);

/** Creates or refreshes one content view and queues analytics for new views. */
const upsertContentView = Effect.fn("contentViews.upsertContentView")(
  function* (args: {
    contentRef: ContentRef;
    deviceId: string;
    locale: Locale;
    slug: string;
    userId?: Id<"users">;
  }) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const now = yield* Clock.currentTimeMillis;
    const existingByDeviceOption = yield* reader
      .table("contentViews")
      .index("by_deviceId_and_contentRefId", (query) =>
        query
          .eq("deviceId", args.deviceId)
          .eq("contentRef.id", args.contentRef.id)
      )
      .first();
    const existingByDevice = Option.getOrNull(existingByDeviceOption);
    const existingByUser = args.userId
      ? Option.getOrNull(
          yield* reader
            .table("contentViews")
            .index("by_userId_and_contentRefId", (query) =>
              query
                .eq("userId", args.userId)
                .eq("contentRef.id", args.contentRef.id)
            )
            .first()
        )
      : null;
    const existingView = existingByDevice ?? existingByUser;

    if (existingView) {
      yield* writer.table("contentViews").patch(existingView._id, {
        lastViewedAt: now,
      });

      return { success: true, isNewView: false, alreadyViewed: true };
    }

    const partition = getContentAnalyticsPartition(args.contentRef);

    yield* writer.table("contentViews").insert({
      contentRef: args.contentRef,
      deviceId: args.deviceId,
      firstViewedAt: now,
      lastViewedAt: now,
      locale: args.locale,
      slug: args.slug,
      userId: args.userId,
    });
    yield* writer.table("contentViewAnalyticsQueue").insert({
      contentRef: args.contentRef,
      locale: args.locale,
      partition,
      viewedAt: now,
    });

    return { success: true, isNewView: true, alreadyViewed: false };
  }
);

/** Records a content view and schedules analytics processing for new views. */
export const recordContentView = Effect.fn("contentViews.recordContentView")(
  function* (args: {
    contentRef: ContentViewRef;
    deviceId: string;
    locale: Locale;
  }) {
    const scheduler = yield* Scheduler;
    const user = yield* getOptionalAppUser();
    const contentRef = yield* loadContentRefBySlug({
      contentRef: args.contentRef,
      locale: args.locale,
    }).pipe(Effect.catchTag("ContentViewNotFound", () => Effect.succeed(null)));

    if (!contentRef) {
      return { success: false, isNewView: false, alreadyViewed: false };
    }

    const result = yield* upsertContentView({
      contentRef,
      deviceId: args.deviceId,
      locale: args.locale,
      slug: args.contentRef.slug,
      userId: user?.appUser._id,
    });

    if (!result.isNewView) {
      return result;
    }

    yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.contents.mutations.analytics
        .scheduleContentAnalyticsPartition,
      { partition: getContentAnalyticsPartition(contentRef) }
    );

    return result;
  }
);

/** Returns recent subject-section views for the current user. */
export const getRecentlyViewed = Effect.fn("contentViews.getRecentlyViewed")(
  function* (args: { limit?: number; locale: Locale }) {
    const reader = yield* DatabaseReader;
    const user = yield* getOptionalAppUser();

    if (!user) {
      return [];
    }

    const limit = args.limit ?? DEFAULT_RECENTLY_VIEWED_LIMIT;
    const recentViews = yield* reader
      .table("contentViews")
      .index(
        "by_userId_and_contentRefType_and_locale_and_lastViewedAt",
        (query) =>
          query
            .eq("userId", user.appUser._id)
            .eq("contentRef.type", "subject")
            .eq("locale", args.locale),
        "desc"
      )
      .take(limit);

    if (recentViews.length === 0) {
      return [];
    }

    const subjectViews = recentViews.flatMap((view) => {
      if (view.contentRef.type !== "subject") {
        return [];
      }

      return [
        {
          lastViewedAt: view.lastViewedAt,
          slug: view.slug,
          subjectId: view.contentRef.id,
        },
      ];
    });
    const subjectResults = yield* Effect.forEach(subjectViews, (view) =>
      Effect.gen(function* () {
        const subject = yield* reader
          .table("subjectSections")
          .get(view.subjectId)
          .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

        if (!subject) {
          return null;
        }

        return {
          description: subject.description,
          grade: subject.grade,
          id: subject._id,
          lastViewedAt: view.lastViewedAt,
          material: subject.material,
          slug: view.slug,
          title: subject.title,
        };
      })
    );
    const results = subjectResults.filter((subject) => subject !== null);

    return results;
  }
);
