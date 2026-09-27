import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { getOptionalActiveAppUser } from "@repo/backend/confect/auth/session";
import type { LearningContextStorage } from "@repo/backend/confect/contents/context";
import { resolveLearningContext } from "@repo/backend/confect/contents/views/context";
import { upsertUserRecent } from "@repo/backend/confect/contents/views/recent";
import {
  enqueuePopularitySignals,
  schedulePopularityPartitions,
} from "@repo/backend/confect/contents/views/signals";
import {
  type RecordContentViewArgs,
  toContentViewIoError,
} from "@repo/backend/confect/contents/views/spec";
import {
  type ContentViewTarget,
  validateIncomingContentTarget,
} from "@repo/backend/confect/contents/views/target";
import { Clock, Effect, flow, Option } from "effect";

/** Loads the latest view row recorded for a device/content/context tuple. */
const loadLatestDeviceView = Effect.fn("contents.views.loadLatestDeviceView")(
  function* (
    contentId: ContentViewTarget["content_id"],
    contextKey: string,
    deviceId: string
  ) {
    const database = yield* DatabaseReader;
    return yield* database
      .table("learningViews")
      .index(
        "by_deviceId_and_content_id_and_contextKey_and_lastViewedAt",
        (q) =>
          q
            .eq("deviceId", deviceId)
            .eq("content_id", contentId)
            .eq("contextKey", contextKey),
        "desc"
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
  },
  Effect.catchDefect(flow(toContentViewIoError, Effect.fail))
);

/** Loads the view row owned by an authenticated user on the current device. */
const loadSignedInDeviceView = Effect.fn(
  "contents.views.loadSignedInDeviceView"
)(
  function* (
    contentId: ContentViewTarget["content_id"],
    contextKey: string,
    input: {
      readonly deviceId: string;
      readonly userId: Docs["users"]["_id"];
    }
  ) {
    const database = yield* DatabaseReader;
    return yield* database
      .table("learningViews")
      .index("by_userId_and_deviceId_and_content_id_and_contextKey", (q) =>
        q
          .eq("userId", input.userId)
          .eq("deviceId", input.deviceId)
          .eq("content_id", contentId)
          .eq("contextKey", contextKey)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
  },
  Effect.catchDefect(flow(toContentViewIoError, Effect.fail))
);

/**
 * Loads the only existing view row this request may mutate.
 *
 * Signed-in requests can touch their exact user-device row or claim an
 * anonymous device row. They never mutate a row owned by another signed-in
 * learner or a row from another device.
 */
const loadExistingView = Effect.fn("contents.views.loadExistingView")(
  function* (
    contentId: ContentViewTarget["content_id"],
    contextKey: string,
    input: {
      readonly deviceId: string;
      readonly userId?: Docs["users"]["_id"];
    }
  ) {
    const existingByDevice = yield* loadLatestDeviceView(
      contentId,
      contextKey,
      input.deviceId
    );
    if (!input.userId) {
      return existingByDevice;
    }
    const existingBySignedInDevice = yield* loadSignedInDeviceView(
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
const insertNewView = Effect.fn("contents.views.insertNewView")(
  function* (
    route: ContentViewTarget,
    args: RecordContentViewArgs,
    context: LearningContextStorage,
    input: {
      readonly now: number;
      readonly userId?: Docs["users"]["_id"];
    }
  ) {
    const writer = yield* DatabaseWriter;
    yield* writer
      .table("learningViews")
      .insert({
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
        ...(input.userId
          ? {
              userId: input.userId,
            }
          : {}),
      })
      .pipe(Effect.orDie);
  },
  Effect.catchDefect(flow(toContentViewIoError, Effect.fail))
);

/** Touches the existing view row and links it to the signed-in user when known. */
const updateExistingView = Effect.fn("contents.views.updateExistingView")(
  function* (
    view: Docs["learningViews"],
    input: {
      readonly now: number;
      readonly userId?: Docs["users"]["_id"];
    }
  ) {
    const writer = yield* DatabaseWriter;
    if (input.userId && !view.userId) {
      yield* writer.table("learningViews").patch(view._id, {
        lastViewedAt: input.now,
        userId: input.userId,
      });
      return;
    }
    yield* writer.table("learningViews").patch(view._id, {
      lastViewedAt: input.now,
    });
  },
  Effect.mapError(toContentViewIoError)
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
)(function* (args: RecordContentViewArgs) {
  const authContext = yield* getOptionalActiveAppUser().pipe(
    Effect.mapError(toContentViewIoError)
  );
  const target = yield* validateIncomingContentTarget(args);
  if (!target) {
    return {
      alreadyViewed: false,
      isNewView: false,
      success: false,
    };
  }
  const now = yield* Clock.currentTimeMillis;
  const userId = authContext?.appUser._id;
  const learningContext = yield* resolveLearningContext(target, args.context);
  const existingView = yield* loadExistingView(
    target.content_id,
    learningContext.contextKey,
    {
      deviceId: args.deviceId,
      ...(userId === undefined
        ? {}
        : {
            userId,
          }),
    }
  );
  if (existingView) {
    // Unsigned repeats can prove device-level dedupe, but must not mutate or
    // emit analytics from a row owned by a signed-in learner.
    if (!userId && existingView.userId) {
      return {
        alreadyViewed: true,
        isNewView: false,
        success: true,
      };
    }
    const popularityUserId = userId ?? existingView.userId;
    yield* updateExistingView(existingView, {
      now,
      ...(userId === undefined
        ? {}
        : {
            userId,
          }),
    });
    if (userId) {
      yield* upsertUserRecent(target, learningContext, {
        lastViewedAt: now,
        userId,
      });
    }
    const partitions = yield* enqueuePopularitySignals(
      target,
      args,
      learningContext,
      {
        now,
        ...(popularityUserId === undefined
          ? {}
          : {
              userId: popularityUserId,
            }),
      }
    );
    yield* schedulePopularityPartitions(partitions);
    return {
      alreadyViewed: true,
      isNewView: false,
      success: true,
    };
  }
  yield* insertNewView(target, args, learningContext, {
    now,
    ...(userId === undefined
      ? {}
      : {
          userId,
        }),
  });
  if (userId) {
    yield* upsertUserRecent(target, learningContext, {
      lastViewedAt: now,
      userId,
    });
  }
  const partitions = yield* enqueuePopularitySignals(
    target,
    args,
    learningContext,
    {
      now,
      ...(userId === undefined
        ? {}
        : {
            userId,
          }),
    }
  );
  yield* schedulePopularityPartitions(partitions);
  return {
    alreadyViewed: false,
    isNewView: true,
    success: true,
  };
});
