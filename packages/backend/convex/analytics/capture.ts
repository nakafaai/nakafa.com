import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { ProductAnalyticsEvent } from "@repo/backend/convex/analytics/events";
import { posthog } from "@repo/backend/convex/posthog";

type ProductAnalyticsCtx = Pick<MutationCtx, "scheduler">;

/**
 * Capture one backend product event through the official PostHog Convex component.
 */
export async function captureProductEvent(
  ctx: ProductAnalyticsCtx,
  {
    distinctId,
    event,
    timestamp,
  }: {
    distinctId: Id<"users">;
    event: ProductAnalyticsEvent;
    timestamp?: Date;
  }
) {
  await posthog.capture(ctx, {
    distinctId,
    disableGeoip: true,
    event: event.name,
    properties: event.properties,
    timestamp,
  });
}
