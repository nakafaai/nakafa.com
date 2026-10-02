import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import {
  createCanonicalLearningContext,
  type LearningContextStorage,
} from "@repo/backend/confect/contents/context";
import { getContentAnalyticsPartition } from "@repo/backend/confect/contents/helpers/partitions";
import {
  createPopularityViewerKey,
  getPopularitySignalDay,
  type LearningPopularityScope,
} from "@repo/backend/confect/contents/popularity";
import {
  type RecordContentViewArgs,
  toContentViewIoError,
} from "@repo/backend/confect/contents/views/spec";
import type { ContentViewTarget } from "@repo/backend/confect/contents/views/target";
import type { ContentViewer } from "@repo/backend/confect/contents/views/viewer";
import { Duration, Effect, flow, Struct } from "effect";

/** Creates one popularity signal scope from verified learning-context storage. */
function createSignalScope(
  context: LearningContextStorage,
  scopeMode: LearningPopularityScope
) {
  return {
    context,
    scopeMode,
  };
}

/** Returns the popularity scopes produced by one verified learning context. */
function createSignalScopes(context: LearningContextStorage) {
  const scopes = [
    createSignalScope(createCanonicalLearningContext(), "global"),
  ];
  if (context.contextMode === "placement") {
    scopes.push(createSignalScope(context, "placement"));
  }
  return scopes;
}

/** Loads an existing viewer signal for one content/context/day identity. */
const loadViewerSignal = Effect.fn("contents.views.loadViewerSignal")(
  function* (
    scope: ReturnType<typeof createSignalScopes>[number],
    input: {
      readonly contentId: ContentViewTarget["content_id"];
      readonly signalDay: number;
      readonly viewerKey: string;
    }
  ) {
    const database = yield* DatabaseReader;
    return yield* database
      .table("learningPopularityViewerSignals")
      .get(
        "by_viewer_content_day_scope_context",
        input.viewerKey,
        input.contentId,
        input.signalDay,
        scope.scopeMode,
        scope.context.contextKey
      )
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
  },
  Effect.catchDefect(flow(toContentViewIoError, Effect.fail))
);

/** Inserts one daily popularity signal if the viewer has not contributed yet. */
const enqueueSignalScope = Effect.fn("contents.views.enqueueSignalScope")(
  function* (
    route: ContentViewTarget,
    args: RecordContentViewArgs,
    scope: ReturnType<typeof createSignalScopes>[number],
    input: {
      readonly now: number;
      readonly viewer: ContentViewer;
    }
  ) {
    const writer = yield* DatabaseWriter;
    const signalDay = getPopularitySignalDay(input.now);
    const viewerKey = createPopularityViewerKey(input.viewer);
    const existingSignal = yield* loadViewerSignal(scope, {
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
      const existingDeviceSignal = yield* loadViewerSignal(scope, {
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
      `${route.content_id}:${scope.scopeMode}:${scope.context.contextKey}`
    );
    yield* writer
      .table("learningPopularityViewerSignals")
      .insert({
        alignmentId: route.alignmentId,
        assetId: route.assetId,
        conceptId: route.conceptId,
        content_id: route.content_id,
        ...scope.context,
        learningObjectId: route.learningObjectId,
        lensId: route.lensId,
        locale: args.locale,
        scopeMode: scope.scopeMode,
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
        ...scope.context,
        ...Struct.pick(route, ["description"]),
        insertedAt: input.now,
        learningObjectId: route.learningObjectId,
        lensId: route.lensId,
        locale: args.locale,
        ...(route.kind === "curriculum-lesson"
          ? {
              materialDomain: route.materialDomain,
            }
          : {}),
        partition,
        route: route.route,
        scopeMode: scope.scopeMode,
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

/** Enqueues daily global and placement popularity signals for one view event. */
export const enqueuePopularitySignals = Effect.fn(
  "contents.views.enqueuePopularitySignals"
)(function* (
  route: ContentViewTarget,
  args: RecordContentViewArgs,
  context: LearningContextStorage,
  input: {
    readonly now: number;
    readonly viewer: ContentViewer;
  }
) {
  const partitions = new Set<number>();
  for (const scope of createSignalScopes(context)) {
    const partition = yield* enqueueSignalScope(route, args, scope, input);
    if (partition !== null) {
      partitions.add(partition);
    }
  }
  return [...partitions];
});

/** Schedules bounded popularity processing for every newly enqueued partition. */
export const schedulePopularityPartitions = Effect.fn(
  "contents.views.schedulePopularityPartitions"
)(function* (partitions: readonly number[]) {
  const scheduler = yield* Scheduler;
  for (const partition of partitions) {
    yield* scheduler.runAfter(
      Duration.zero,
      refs.internal.contents.mutations.analytics
        .scheduleContentAnalyticsPartition,
      {
        partition,
      }
    );
  }
});
