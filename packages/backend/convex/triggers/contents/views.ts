import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { captureProductEvent } from "@repo/backend/convex/analytics/capture";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";

/**
 * Captures signed-in content views after the durable engagement row is written.
 */
export async function contentViewsHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "contentViews">
) {
  const view = change.newDoc;

  if (!view?.userId) {
    return;
  }

  await captureProductEvent(ctx, {
    distinctId: view.userId,
    event: {
      name: "content viewed",
      properties: {
        content_type: view.contentRef.type,
        is_new_view: change.operation === "insert",
        locale: view.locale,
        slug: view.slug,
      },
    },
    timestamp: new Date(view.lastViewedAt),
  });
}
