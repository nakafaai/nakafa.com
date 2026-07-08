import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type {
  ScheduleContentAnalyticsPartitionArgs,
  ScheduleContentAnalyticsPartitionResult,
} from "@repo/backend/convex/contents/analytics/spec";
import type { LearningContextStorage } from "@repo/backend/convex/contents/context";
import { resolveLearningContext } from "@repo/backend/convex/contents/views/context";
import { upsertUserRecent } from "@repo/backend/convex/contents/views/recent";
import { enqueuePopularitySignals } from "@repo/backend/convex/contents/views/signals";
import {
  ContentViewIoError,
  contentViewIoFailedCode,
  type RecordContentViewArgs,
} from "@repo/backend/convex/contents/views/spec";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import type { FunctionReference } from "convex/server";
import { Clock, Effect } from "effect";

/** Generated internal mutation reference accepted by Convex's scheduler. */
type ScheduleContentAnalyticsPartitionReference = FunctionReference<
  "mutation",
  "internal",
  ScheduleContentAnalyticsPartitionArgs,
  ScheduleContentAnalyticsPartitionResult
>;

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
      route.kind === "tryout-set"
    ) {
      return route;
    }

    return null;
  }
);

/** Loads the latest view row recorded for a device/content/context tuple. */
const loadLatestDeviceView = Effect.fn("contents.views.loadLatestDeviceView")(
  function* (
    db: MutationCtx["db"],
    contentId: Doc<"contentRoutes">["content_id"],
    contextKey: string,
    deviceId: string
  ) {
    return yield* Effect.tryPromise({
      try: () =>
        db
          .query("learningViews")
          .withIndex(
            "by_deviceId_and_content_id_and_contextKey_and_lastViewedAt",
            (q) =>
              q
                .eq("deviceId", deviceId)
                .eq("content_id", contentId)
                .eq("contextKey", contextKey)
          )
          .order("desc")
          .first(),
      catch: toContentViewIoError,
    });
  }
);

/** Loads the view row owned by an authenticated user on the current device. */
const loadSignedInDeviceView = Effect.fn(
  "contents.views.loadSignedInDeviceView"
)(function* (
  db: MutationCtx["db"],
  contentId: Doc<"contentRoutes">["content_id"],
  contextKey: string,
  input: {
    readonly deviceId: string;
    readonly userId: Doc<"users">["_id"];
  }
) {
  return yield* Effect.tryPromise({
    try: () =>
      db
        .query("learningViews")
        .withIndex(
          "by_userId_and_deviceId_and_content_id_and_contextKey",
          (q) =>
            q
              .eq("userId", input.userId)
              .eq("deviceId", input.deviceId)
              .eq("content_id", contentId)
              .eq("contextKey", contextKey)
        )
        .first(),
    catch: toContentViewIoError,
  });
});

/**
 * Loads the only existing view row this request may mutate.
 *
 * Signed-in requests can touch their exact user-device row or claim an
 * anonymous device row. They never mutate a row owned by another signed-in
 * learner or a row from another device.
 */
const loadExistingView = Effect.fn("contents.views.loadExistingView")(
  function* (
    db: MutationCtx["db"],
    contentId: Doc<"contentRoutes">["content_id"],
    contextKey: string,
    input: {
      readonly deviceId: string;
      readonly userId?: Doc<"users">["_id"];
    }
  ) {
    const existingByDevice = yield* loadLatestDeviceView(
      db,
      contentId,
      contextKey,
      input.deviceId
    );

    if (!input.userId) {
      return existingByDevice;
    }

    const existingBySignedInDevice = yield* loadSignedInDeviceView(
      db,
      contentId,
      contextKey,
      {
        deviceId: input.deviceId,
        userId: input.userId,
      }
    );

    if (existingBySignedInDevice) {
      return existingBySignedInDevice;
    }

    if (!existingByDevice?.userId) {
      return existingByDevice;
    }

    return null;
  }
);

/** Writes the first durable view row for a viewer/content/context tuple. */
const insertNewView = Effect.fn("contents.views.insertNewView")(function* (
  db: MutationCtx["db"],
  route: Doc<"contentRoutes">,
  args: RecordContentViewArgs,
  context: LearningContextStorage,
  input: {
    readonly now: number;
    readonly userId?: Doc<"users">["_id"];
  }
) {
  yield* Effect.tryPromise({
    try: () =>
      db.insert("learningViews", {
        alignmentId: route.alignmentId,
        assetId: route.assetId,
        conceptId: route.conceptId,
        content_id: route.content_id,
        ...context,
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
});

/** Touches the existing view row and links it to the signed-in user when known. */
const updateExistingView = Effect.fn("contents.views.updateExistingView")(
  function* (
    db: MutationCtx["db"],
    view: Doc<"learningViews">,
    input: {
      readonly now: number;
      readonly userId?: Doc<"users">["_id"];
    }
  ) {
    if (input.userId && !view.userId) {
      yield* Effect.tryPromise({
        try: () =>
          db.patch("learningViews", view._id, {
            lastViewedAt: input.now,
            userId: input.userId,
          }),
        catch: toContentViewIoError,
      });
      return;
    }

    yield* Effect.tryPromise({
      try: () =>
        db.patch("learningViews", view._id, {
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
  scheduleAnalyticsPartition: ScheduleContentAnalyticsPartitionReference
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
  const learningContext = yield* resolveLearningContext(
    ctx.db,
    target,
    args.context
  );
  const existingView = yield* loadExistingView(
    ctx.db,
    target.content_id,
    learningContext.contextKey,
    {
      deviceId: args.deviceId,
      userId,
    }
  );

  if (existingView) {
    // Unsigned repeats can prove device-level dedupe, but must not mutate or
    // emit analytics from a row owned by a signed-in learner.
    if (!userId && existingView.userId) {
      return { alreadyViewed: true, isNewView: false, success: true };
    }

    const popularityUserId = userId ?? existingView.userId;

    yield* updateExistingView(ctx.db, existingView, { now, userId });
    if (userId) {
      yield* upsertUserRecent(ctx.db, target, learningContext, {
        lastViewedAt: now,
        userId,
      });
    }

    const partitions = yield* enqueuePopularitySignals(
      ctx.db,
      target,
      args,
      learningContext,
      {
        now,
        userId: popularityUserId,
      }
    );

    for (const partition of partitions) {
      yield* Effect.tryPromise({
        try: () =>
          ctx.scheduler.runAfter(0, scheduleAnalyticsPartition, { partition }),
        catch: toContentViewIoError,
      });
    }

    return { alreadyViewed: true, isNewView: false, success: true };
  }

  yield* insertNewView(ctx.db, target, args, learningContext, {
    now,
    userId,
  });

  if (userId) {
    yield* upsertUserRecent(ctx.db, target, learningContext, {
      lastViewedAt: now,
      userId,
    });
  }

  const partitions = yield* enqueuePopularitySignals(
    ctx.db,
    target,
    args,
    learningContext,
    {
      now,
      userId,
    }
  );

  for (const partition of partitions) {
    yield* Effect.tryPromise({
      try: () =>
        ctx.scheduler.runAfter(0, scheduleAnalyticsPartition, { partition }),
      catch: toContentViewIoError,
    });
  }

  return { alreadyViewed: false, isNewView: true, success: true };
});
