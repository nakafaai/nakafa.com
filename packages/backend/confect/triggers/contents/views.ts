import { captureProductEvent } from "@repo/backend/confect/analytics/capture";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import type { Change } from "convex-helpers/server/triggers";
import { Effect } from "effect";

/** Emits one product analytics event after a graph content view is persisted. */
export const learningViewsHandler = Effect.fn(
  "triggers.contents.captureContentViewEvent"
)(function* (change: Change<DataModel, "learningViews">) {
  const view = change.newDoc;
  if (!view?.userId) {
    return;
  }
  const userId = view.userId;
  yield* captureProductEvent({
    distinctId: userId,
    event: {
      name: "content viewed",
      properties: {
        alignment_id: view.alignmentId,
        concept_id: view.conceptId,
        content_id: view.content_id,
        context_key: view.contextKey,
        content_type: view.section === "articles" ? "article" : "material",
        is_new_view: change.operation === "insert",
        learning_object_id: view.learningObjectId,
        lens_id: view.lensId,
        locale: view.locale,
        route: view.route,
      },
    },
    timestamp: new Date(view.lastViewedAt),
  });
});
