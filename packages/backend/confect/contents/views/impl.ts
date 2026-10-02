import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
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
import {
  type ContentViewer,
  loadViewerView,
  resolveContentViewer,
} from "@repo/backend/confect/contents/views/viewer";
import { Clock, Effect, flow, Option } from "effect";

const notRecorded = {
  alreadyViewed: false,
  isNewView: false,
  success: false,
};
const alreadyViewed = {
  alreadyViewed: true,
  isNewView: false,
  success: true,
};

/** Writes the first durable view row for a viewer/content/context tuple. */
const insertNewView = Effect.fn("contents.views.insertNewView")(
  function* (
    route: ContentViewTarget,
    args: RecordContentViewArgs,
    context: LearningContextStorage,
    input: {
      readonly now: number;
      readonly viewer: ContentViewer;
    }
  ) {
    const { viewer } = input;
    const writer = yield* DatabaseWriter;
    yield* writer
      .table("learningViews")
      .insert({
        alignmentId: route.alignmentId,
        assetId: route.assetId,
        conceptId: route.conceptId,
        content_id: route.content_id,
        ...context,
        ...(viewer.deviceId === undefined ? {} : { deviceId: viewer.deviceId }),
        firstViewedAt: input.now,
        lastViewedAt: input.now,
        learningObjectId: route.learningObjectId,
        lensId: route.lensId,
        locale: args.locale,
        route: route.route,
        section: route.section,
        ...(viewer.kind === "account" ? { userId: viewer.userId } : {}),
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
      readonly viewer: ContentViewer;
    }
  ) {
    const writer = yield* DatabaseWriter;
    if (input.viewer.kind === "account" && !view.userId) {
      yield* writer.table("learningViews").patch(view._id, {
        lastViewedAt: input.now,
        userId: input.viewer.userId,
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
 * A signed-out view without a device identifier comes from a browser without
 * analytics consent, so nothing is recorded for it. The primary write stays
 * small and derived popularity work is deferred to a scheduled mutation to
 * keep the hot user-facing mutation bounded.
 * @see https://docs.convex.dev/understanding/best-practices/
 */
export const recordUniqueContentView = Effect.fn(
  "contents.views.recordUniqueContentView"
)(function* (args: RecordContentViewArgs) {
  const authContext = yield* getOptionalActiveAppUser().pipe(
    Effect.mapError(toContentViewIoError)
  );
  const viewer = resolveContentViewer({
    ...(args.deviceId === undefined ? {} : { deviceId: args.deviceId }),
    ...(authContext ? { userId: authContext.appUser._id } : {}),
  });
  if (Option.isNone(viewer)) {
    return notRecorded;
  }
  const target = yield* validateIncomingContentTarget(args);
  if (!target) {
    return notRecorded;
  }
  const now = yield* Clock.currentTimeMillis;
  const learningContext = yield* resolveLearningContext(target, args.context);
  const existingView = yield* loadViewerView(
    target.content_id,
    learningContext.contextKey,
    viewer.value
  );
  // A device repeat can prove device-level dedupe, but must not mutate or
  // emit analytics from a row owned by a signed-in learner.
  if (viewer.value.kind === "device" && existingView?.userId) {
    return alreadyViewed;
  }
  if (existingView) {
    yield* updateExistingView(existingView, { now, viewer: viewer.value });
  } else {
    yield* insertNewView(target, args, learningContext, {
      now,
      viewer: viewer.value,
    });
  }
  if (viewer.value.kind === "account") {
    yield* upsertUserRecent(target, learningContext, {
      lastViewedAt: now,
      userId: viewer.value.userId,
    });
  }
  const partitions = yield* enqueuePopularitySignals(
    target,
    args,
    learningContext,
    { now, viewer: viewer.value }
  );
  yield* schedulePopularityPartitions(partitions);
  if (existingView) {
    return alreadyViewed;
  }
  return {
    alreadyViewed: false,
    isNewView: true,
    success: true,
  };
});
