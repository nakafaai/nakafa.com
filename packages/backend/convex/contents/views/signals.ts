import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createCanonicalLearningContext,
  type LearningContextStorage,
} from "@repo/backend/convex/contents/context";
import { getContentAnalyticsPartition } from "@repo/backend/convex/contents/helpers/partitions";
import {
  createPopularityViewerKey,
  getPopularitySignalDay,
  type LearningPopularityScope,
} from "@repo/backend/convex/contents/popularity";
import {
  ContentViewIoError,
  contentViewIoFailedCode,
  type RecordContentViewArgs,
} from "@repo/backend/convex/contents/views/spec";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import { Effect } from "effect";

/** Popularity namespace produced from one verified engagement context. */
interface SignalScope {
  readonly context: LearningContextStorage;
  readonly scopeMode: LearningPopularityScope;
}

/** Viewer identity and timestamp used to de-duplicate daily signals. */
interface SignalInput {
  readonly now: number;
  readonly userId?: Doc<"users">["_id"];
}

/** Maps thrown Convex IO failures into the content-view error channel. */
function toSignalIoError(error: unknown) {
  return new ContentViewIoError({
    code: contentViewIoFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

/** Returns the popularity scopes produced by one verified learning context. */
function createSignalScopes(context: LearningContextStorage): SignalScope[] {
  const scopes: SignalScope[] = [
    {
      context: createCanonicalLearningContext(),
      scopeMode: "global",
    },
  ];

  if (context.contextMode === "placement") {
    scopes.push({
      context,
      scopeMode: "placement",
    });
  }

  return scopes;
}

/** Inserts one daily popularity signal if the viewer has not contributed yet. */
const enqueueSignalScope = Effect.fn("contents.views.enqueueSignalScope")(
  function* (
    db: MutationCtx["db"],
    route: Doc<"contentRoutes">,
    args: RecordContentViewArgs,
    scope: SignalScope,
    input: SignalInput
  ) {
    const signalDay = getPopularitySignalDay(input.now);
    const viewerKey = createPopularityViewerKey({
      deviceId: args.deviceId,
      userId: input.userId,
    });
    const existingSignal = yield* Effect.tryPromise({
      try: () =>
        db
          .query("learningPopularityViewerSignals")
          .withIndex("by_viewer_content_day_scope_context", (q) =>
            q
              .eq("viewerKey", viewerKey)
              .eq("content_id", route.content_id)
              .eq("signalDay", signalDay)
              .eq("scopeMode", scope.scopeMode)
              .eq("contextKey", scope.context.contextKey)
          )
          .unique(),
      catch: toSignalIoError,
    });

    if (existingSignal) {
      return null;
    }

    const partition = getContentAnalyticsPartition(
      `${route.content_id}:${scope.scopeMode}:${scope.context.contextKey}`
    );

    yield* Effect.tryPromise({
      try: () =>
        db.insert("learningPopularityViewerSignals", {
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
        }),
      catch: toSignalIoError,
    });

    yield* Effect.tryPromise({
      try: () =>
        db.insert("learningEngagementQueue", {
          alignmentId: route.alignmentId,
          assetId: route.assetId,
          conceptId: route.conceptId,
          content_id: route.content_id,
          ...scope.context,
          description: route.description,
          insertedAt: input.now,
          learningObjectId: route.learningObjectId,
          lensId: route.lensId,
          locale: args.locale,
          materialDomain: route.materialDomain,
          partition,
          route: route.route,
          scopeMode: scope.scopeMode,
          section: route.section,
          sourcePath: route.sourcePath,
          title: route.title,
          viewedAt: input.now,
          viewerKey,
        }),
      catch: toSignalIoError,
    });

    return partition;
  }
);

/** Enqueues daily global and placement popularity signals for one view event. */
export const enqueuePopularitySignals = Effect.fn(
  "contents.views.enqueuePopularitySignals"
)(function* (
  db: MutationCtx["db"],
  route: Doc<"contentRoutes">,
  args: RecordContentViewArgs,
  context: LearningContextStorage,
  input: SignalInput
) {
  const partitions = new Set<number>();

  for (const scope of createSignalScopes(context)) {
    const partition = yield* enqueueSignalScope(db, route, args, scope, input);

    if (partition !== null) {
      partitions.add(partition);
    }
  }

  return [...partitions];
});
