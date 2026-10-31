import contentsInternal from "@repo/backend/confect/_generated/refs/contents.server";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { createCanonicalLearningContext } from "@repo/backend/confect/contents/context";
import { getContentAnalyticsPartition } from "@repo/backend/confect/contents/partitions";
import {
  createPopularityViewerKey,
  getPopularitySignalDay,
  POPULARITY_SCOPE,
  POPULARITY_SECTION,
} from "@repo/backend/confect/contents/popularity";
import {
  type RecordContentViewArgs,
  toContentViewIoError,
} from "@repo/backend/confect/contents/views/spec";
import type { ContentViewTarget } from "@repo/backend/confect/contents/views/target";
import type { ContentViewer } from "@repo/backend/confect/contents/views/viewer";
import { Duration, Effect, flow, Struct } from "effect";

/** The ranking is global, so every popularity row uses the canonical context. */
const context = createCanonicalLearningContext();

/** Loads an existing viewer signal for one content/day identity. */
const loadViewerSignal = Effect.fn("contents.views.loadViewerSignal")(
  function* (input: {
    readonly contentId: ContentViewTarget["content_id"];
    readonly signalDay: number;
    readonly viewerKey: string;
  }) {
    const database = yield* DatabaseReader;
    return yield* database
      .table("learningPopularityViewerSignals")
      .get(
        "by_viewer_content_day_scope_context",
        input.viewerKey,
        input.contentId,
        input.signalDay,
        POPULARITY_SCOPE,
        context.contextKey
      )
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
  },
  Effect.catchDefect(flow(toContentViewIoError, Effect.fail))
);

/**
 * Inserts one daily popularity signal if the viewer has not contributed yet,
 * and returns the analytics partition that must drain it.
 *
 * Only a material view feeds the ranking the homepage reads, in its global
 * scope, so any other view writes nothing here.
 */
export const enqueuePopularitySignal = Effect.fn(
  "contents.views.enqueuePopularitySignal"
)(
  function* (
    route: ContentViewTarget,
    args: RecordContentViewArgs,
    input: {
      readonly now: number;
      readonly viewer: ContentViewer;
    }
  ) {
    if (route.section !== POPULARITY_SECTION) {
      return null;
    }
    const writer = yield* DatabaseWriter;
    const signalDay = getPopularitySignalDay(input.now);
    const viewerKey = createPopularityViewerKey(input.viewer);
    const existingSignal = yield* loadViewerSignal({
      contentId: route.content_id,
      signalDay,
      viewerKey,
    });
    if (existingSignal) {
      return null;
    }
    // An account view from a consented device already counted anonymously
    // today must not count again under the account.
    if (
      input.viewer.kind === "account" &&
      input.viewer.deviceId !== undefined
    ) {
      const existingDeviceSignal = yield* loadViewerSignal({
        contentId: route.content_id,
        signalDay,
        viewerKey: createPopularityViewerKey({
          deviceId: input.viewer.deviceId,
          kind: "device",
        }),
      });
      if (existingDeviceSignal) {
        return null;
      }
    }
    const partition = getContentAnalyticsPartition(
      `${route.content_id}:${POPULARITY_SCOPE}:${context.contextKey}`
    );
    yield* writer
      .table("learningPopularityViewerSignals")
      .insert({
        alignmentId: route.alignmentId,
        assetId: route.assetId,
        conceptId: route.conceptId,
        content_id: route.content_id,
        ...context,
        learningObjectId: route.learningObjectId,
        lensId: route.lensId,
        locale: args.locale,
        scopeMode: POPULARITY_SCOPE,
        section: route.section,
        signalDay,
        viewedAt: input.now,
        viewerKey,
      })
      .pipe(Effect.orDie);
    yield* writer
      .table("learningEngagementQueue")
      .insert({
        alignmentId: route.alignmentId,
        assetId: route.assetId,
        conceptId: route.conceptId,
        content_id: route.content_id,
        ...context,
        ...Struct.pick(route, ["description"]),
        insertedAt: input.now,
        learningObjectId: route.learningObjectId,
        lensId: route.lensId,
        locale: args.locale,
        materialDomain: route.materialDomain,
        partition,
        route: route.route,
        scopeMode: POPULARITY_SCOPE,
        section: route.section,
        sourcePath: route.sourcePath,
        title: route.title,
        viewedAt: input.now,
        viewerKey,
      })
      .pipe(Effect.orDie);
    return partition;
  },
  Effect.catchDefect(flow(toContentViewIoError, Effect.fail))
);

/** Schedules bounded popularity processing for a newly enqueued partition. */
export const schedulePopularityPartition = Effect.fn(
  "contents.views.schedulePopularityPartition"
)(function* (partition: number | null) {
  if (partition === null) {
    return;
  }
  const scheduler = yield* Scheduler;
  yield* scheduler.runAfter(
    Duration.zero,
    contentsInternal.mutations.analytics.scheduleContentAnalyticsPartition,
    {
      partition,
    }
  );
});
