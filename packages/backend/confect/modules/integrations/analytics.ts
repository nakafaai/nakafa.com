import { posthog } from "@repo/backend/confect/modules/integrations/posthog";

/** Captures a product analytics event through the PostHog Convex component. */
export async function captureProductEvent(
  ctx: Parameters<typeof posthog.capture>[0],
  {
    distinctId,
    event,
    timestamp,
  }: {
    readonly distinctId: string;
    readonly event: {
      readonly name: string;
      readonly properties: Record<string, unknown>;
    };
    readonly timestamp: Date;
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
