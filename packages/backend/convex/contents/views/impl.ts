import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type {
  ScheduleContentAnalyticsPartitionArgs,
  ScheduleContentAnalyticsPartitionResult,
} from "@repo/backend/convex/contents/analytics/spec";
import { getContentAnalyticsPartition } from "@repo/backend/convex/contents/helpers/partitions";
import {
  ContentViewIoError,
  contentViewIoFailedCode,
  type RecordContentViewArgs,
  type RecordContentViewResult,
} from "@repo/backend/convex/contents/views/spec";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import type { ContentRef } from "@repo/backend/convex/lib/validators/contents";
import type { FunctionReference } from "convex/server";
import { Clock, Effect } from "effect";

export interface ContentViewSchedulerTargets {
  readonly scheduleAnalyticsPartition: FunctionReference<
    "mutation",
    "internal",
    ScheduleContentAnalyticsPartitionArgs,
    ScheduleContentAnalyticsPartitionResult
  >;
}

/** Maps thrown Convex IO failures into the content-view error channel. */
function toContentViewIoError(error: unknown) {
  return new ContentViewIoError({
    code: contentViewIoFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

/** Resolves the durable content reference for a graph content ID. */
const loadContentTarget = Effect.fn("contents.views.loadContentTarget")(
  function* (db: MutationCtx["db"], args: RecordContentViewArgs) {
    const route = yield* Effect.tryPromise({
      try: () =>
        db
          .query("contentRoutes")
          .withIndex("by_content_id", (q) => q.eq("content_id", args.contentId))
          .unique(),
      catch: toContentViewIoError,
    });

    if (!route) {
      return null;
    }

    if (route.locale !== args.locale || route.content_id !== route.assetId) {
      return null;
    }

    if (route.kind === "article") {
      const article = yield* Effect.tryPromise({
        try: () =>
          db
            .query("articleContents")
            .withIndex("by_locale_and_slug", (q) =>
              q.eq("locale", route.locale).eq("slug", route.route)
            )
            .first(),
        catch: toContentViewIoError,
      });

      return article
        ? {
            contentRef: {
              id: article._id,
              type: "article",
            } satisfies ContentRef,
            route,
          }
        : null;
    }

    if (route.kind === "subject-section") {
      const section = yield* Effect.tryPromise({
        try: () =>
          db
            .query("subjectSections")
            .withIndex("by_locale_and_slug", (q) =>
              q.eq("locale", route.locale).eq("slug", route.route)
            )
            .first(),
        catch: toContentViewIoError,
      });

      return section
        ? {
            contentRef: {
              id: section._id,
              type: "subject",
            } satisfies ContentRef,
            route,
          }
        : null;
    }

    if (route.kind !== "exercise-set") {
      return null;
    }

    const exerciseSet = yield* Effect.tryPromise({
      try: () =>
        db
          .query("exerciseSets")
          .withIndex("by_locale_and_slug", (q) =>
            q.eq("locale", route.locale).eq("slug", route.route)
          )
          .first(),
      catch: toContentViewIoError,
    });

    return exerciseSet
      ? {
          contentRef: {
            id: exerciseSet._id,
            type: "exercise",
          } satisfies ContentRef,
          route,
        }
      : null;
  }
);

/** Loads an existing view for either the device or authenticated user. */
const loadExistingView = Effect.fn("contents.views.loadExistingView")(
  function* (
    db: MutationCtx["db"],
    contentRef: ContentRef,
    input: {
      readonly deviceId: string;
      readonly userId?: Doc<"users">["_id"];
    }
  ) {
    const existingByDevice = yield* Effect.tryPromise({
      try: () =>
        db
          .query("contentViews")
          .withIndex("by_deviceId_and_contentRefId", (q) =>
            q.eq("deviceId", input.deviceId).eq("contentRef.id", contentRef.id)
          )
          .first(),
      catch: toContentViewIoError,
    });

    if (!input.userId) {
      return existingByDevice;
    }

    const existingByUser = yield* Effect.tryPromise({
      try: () =>
        db
          .query("contentViews")
          .withIndex("by_userId_and_contentRefId", (q) =>
            q.eq("userId", input.userId).eq("contentRef.id", contentRef.id)
          )
          .first(),
      catch: toContentViewIoError,
    });

    return existingByDevice ?? existingByUser;
  }
);

/** Writes a new view row and its append-only analytics queue row. */
const insertNewView = Effect.fn("contents.views.insertNewView")(function* (
  db: MutationCtx["db"],
  contentRef: ContentRef,
  route: Doc<"contentRoutes">,
  args: RecordContentViewArgs,
  input: {
    readonly now: number;
    readonly userId?: Doc<"users">["_id"];
  }
) {
  const partition = getContentAnalyticsPartition(contentRef);

  yield* Effect.tryPromise({
    try: () =>
      db.insert("contentViews", {
        contentRef,
        deviceId: args.deviceId,
        firstViewedAt: input.now,
        lastViewedAt: input.now,
        locale: args.locale,
        slug: route.route,
        ...(input.userId ? { userId: input.userId } : {}),
      }),
    catch: toContentViewIoError,
  });

  yield* Effect.tryPromise({
    try: () =>
      db.insert("contentViewAnalyticsQueue", {
        contentRef,
        locale: args.locale,
        partition,
        viewedAt: input.now,
      }),
    catch: toContentViewIoError,
  });

  return partition;
});

/** Touches the existing view row and links it to the signed-in user when known. */
const updateExistingView = Effect.fn("contents.views.updateExistingView")(
  function* (
    db: MutationCtx["db"],
    view: Doc<"contentViews">,
    input: {
      readonly now: number;
      readonly userId?: Doc<"users">["_id"];
    }
  ) {
    if (input.userId && !view.userId) {
      yield* Effect.tryPromise({
        try: () =>
          db.patch("contentViews", view._id, {
            lastViewedAt: input.now,
            userId: input.userId,
          }),
        catch: toContentViewIoError,
      });
      return;
    }

    yield* Effect.tryPromise({
      try: () =>
        db.patch("contentViews", view._id, {
          lastViewedAt: input.now,
        }),
      catch: toContentViewIoError,
    });
  }
);

/**
 * Records one unique content view and schedules derived analytics work.
 *
 * The primary write stays small and derived popularity work is deferred to a
 * scheduled mutation to keep the hot user-facing mutation bounded.
 * @see https://docs.convex.dev/understanding/best-practices/
 */
export const recordUniqueContentView: (
  ctx: MutationCtx,
  args: RecordContentViewArgs,
  targets: ContentViewSchedulerTargets
) => Effect.Effect<RecordContentViewResult, ContentViewIoError> = Effect.fn(
  "contents.views.recordUniqueContentView"
)(function* (
  ctx: MutationCtx,
  args: RecordContentViewArgs,
  targets: ContentViewSchedulerTargets
) {
  const authContext = yield* Effect.tryPromise({
    try: () => getOptionalAppUser(ctx),
    catch: toContentViewIoError,
  });
  const target = yield* loadContentTarget(ctx.db, args);

  if (!target) {
    return { alreadyViewed: false, isNewView: false, success: false };
  }

  const { contentRef, route } = target;
  const now = yield* Clock.currentTimeMillis;
  const userId = authContext?.appUser._id;
  const existingView = yield* loadExistingView(ctx.db, contentRef, {
    deviceId: args.deviceId,
    userId,
  });

  if (existingView) {
    yield* updateExistingView(ctx.db, existingView, { now, userId });
    return { alreadyViewed: true, isNewView: false, success: true };
  }

  const partition = yield* insertNewView(ctx.db, contentRef, route, args, {
    now,
    userId,
  });

  yield* Effect.tryPromise({
    try: () =>
      ctx.scheduler.runAfter(0, targets.scheduleAnalyticsPartition, {
        partition,
      }),
    catch: toContentViewIoError,
  });

  return { alreadyViewed: false, isNewView: true, success: true };
});
