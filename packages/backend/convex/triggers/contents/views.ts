import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { captureProductEvent } from "@repo/backend/convex/analytics/capture";
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

function toContentViewEventError(error: unknown) {
  return new ContentViewEventError({
    code: contentViewEventFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

const captureContentViewEvent = Effect.fn(
  "triggers.contents.captureContentViewEvent"
)(function* (
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "contentViews">
) {
  const view = change.newDoc;

  if (!view?.userId) {
    return;
  }

  const userId = view.userId;
  const route = yield* Effect.tryPromise({
    try: () =>
      ctx.db
        .query("contentRoutes")
        .withIndex("by_locale_and_route", (q) =>
          q.eq("locale", view.locale).eq("route", view.slug)
        )
        .unique(),
    catch: toContentViewEventError,
  });

  if (!route) {
    return;
  }

  yield* Effect.tryPromise({
    try: () =>
      captureProductEvent(ctx, {
        distinctId: userId,
        event: {
          name: "content viewed",
          properties: {
            alignment_id: route.alignmentId,
            concept_id: route.conceptId,
            content_id: route.content_id,
            content_type: view.contentRef.type,
            is_new_view: change.operation === "insert",
            learning_object_id: route.learningObjectId,
            lens_id: route.lensId,
            locale: view.locale,
            route: route.route,
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
export async function contentViewsHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "contentViews">
) {
  await runConvexProgram(captureContentViewEvent(ctx, change));
}
