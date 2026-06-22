import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { captureProductEvent } from "@repo/backend/convex/analytics/capture";
import type { ProductAnalyticsEvent } from "@repo/backend/convex/analytics/events";
import {
  getUnknownErrorMessage,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";
import { Effect, Schema } from "effect";

const contentViewEventFailedCode = "CONTENT_VIEW_EVENT_FAILED";

/** Raised when the content-view analytics trigger cannot read or emit graph data. */
class ContentViewEventError extends Schema.TaggedError<ContentViewEventError>()(
  "ContentViewEventError",
  {
    code: Schema.Literal(contentViewEventFailedCode),
    message: Schema.String,
  }
) {}

/** Maps thrown analytics trigger failures into a typed Effect error. */
function toContentViewEventError(error: unknown) {
  return new ContentViewEventError({
    code: contentViewEventFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

/** Converts a graph route section into the product analytics event taxonomy. */
function getContentViewEventType(
  section: NonNullable<Change<DataModel, "learningViews">["newDoc"]>["section"]
): Extract<
  ProductAnalyticsEvent,
  { name: "content viewed" }
>["properties"]["content_type"] {
  if (section === "articles") {
    return "article";
  }

  if (section === "material") {
    return "material";
  }

  return "material";
}

/** Emits one product analytics event after a graph content view is persisted. */
const captureContentViewEvent = Effect.fn(
  "triggers.contents.captureContentViewEvent"
)(function* (
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "learningViews">
) {
  const view = change.newDoc;

  if (!view?.userId) {
    return;
  }

  const userId = view.userId;

  yield* Effect.tryPromise({
    try: () =>
      captureProductEvent(ctx, {
        distinctId: userId,
        event: {
          name: "content viewed",
          properties: {
            alignment_id: view.alignmentId,
            concept_id: view.conceptId,
            content_id: view.content_id,
            context_key: view.contextKey,
            content_type: getContentViewEventType(view.section),
            is_new_view: change.operation === "insert",
            learning_object_id: view.learningObjectId,
            lens_id: view.lensId,
            locale: view.locale,
            route: view.route,
          },
        },
        timestamp: new Date(view.lastViewedAt),
      }),
    catch: toContentViewEventError,
  });
});

/**
 * Captures signed-in content views after the durable engagement row is written.
 */
export async function learningViewsHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "learningViews">
) {
  await runConvexProgram(captureContentViewEvent(ctx, change));
}
