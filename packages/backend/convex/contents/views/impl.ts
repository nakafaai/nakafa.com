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
} from "@repo/backend/convex/contents/views/spec";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import type { FunctionReference } from "convex/server";
import { Clock, Effect } from "effect";

/** Internal scheduler functions used after a content view is recorded. */
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

/** Resolves the route-catalog projection for a graph content ID. */
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

    if (
      route.kind === "article" ||
      route.kind === "curriculum-lesson" ||
      route.kind === "exercise-set"
    ) {
      return route;
    }

    return null;
  }
);

/** Loads an existing view for either the device or authenticated user. */
const loadExistingView = Effect.fn("contents.views.loadExistingView")(
  function* (
    db: MutationCtx["db"],
    contentId: Doc<"contentRoutes">["content_id"],
    input: {
      readonly deviceId: string;
      readonly userId?: Doc<"users">["_id"];
    }
  ) {
    const existingByDevice = yield* Effect.tryPromise({
      try: () =>
        db
          .query("contentViews")
          .withIndex("by_deviceId_and_content_id", (q) =>
            q.eq("deviceId", input.deviceId).eq("content_id", contentId)
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
          .withIndex("by_userId_and_content_id", (q) =>
            q.eq("userId", input.userId).eq("content_id", contentId)
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
  route: Doc<"contentRoutes">,
  args: RecordContentViewArgs,
  input: {
    readonly now: number;
    readonly userId?: Doc<"users">["_id"];
  }
) {
  const partition = getContentAnalyticsPartition(route.content_id);

  yield* Effect.tryPromise({
    try: () =>
      db.insert("contentViews", {
        alignmentId: route.alignmentId,
        assetId: route.assetId,
        conceptId: route.conceptId,
        content_id: route.content_id,
        deviceId: args.deviceId,
        firstViewedAt: input.now,
        lastViewedAt: input.now,
        learningObjectId: route.learningObjectId,
        lensId: route.lensId,
        locale: args.locale,
        route: route.route,
        section: route.section,
        ...(input.userId ? { userId: input.userId } : {}),
      }),
    catch: toContentViewIoError,
  });

  yield* Effect.tryPromise({
    try: () =>
      db.insert("contentViewAnalyticsQueue", {
        alignmentId: route.alignmentId,
        assetId: route.assetId,
        conceptId: route.conceptId,
        content_id: route.content_id,
        learningObjectId: route.learningObjectId,
        lensId: route.lensId,
        locale: args.locale,
        partition,
        route: route.route,
        section: route.section,
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
export const recordUniqueContentView = Effect.fn(
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

  const now = yield* Clock.currentTimeMillis;
  const userId = authContext?.appUser._id;
  const existingView = yield* loadExistingView(ctx.db, target.content_id, {
    deviceId: args.deviceId,
    userId,
  });

  if (existingView) {
    yield* updateExistingView(ctx.db, existingView, { now, userId });
    return { alreadyViewed: true, isNewView: false, success: true };
  }

  const partition = yield* insertNewView(ctx.db, target, args, {
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
