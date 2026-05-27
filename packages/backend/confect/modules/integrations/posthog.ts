import { PostHog } from "@posthog/convex";
import { components } from "@repo/backend/confect/modules/integrations/convexComponents";
import { posthogEnvironment } from "@repo/backend/confect/modules/integrations/posthog.env";

/** PostHog Convex component adapter. */
export const posthog = new PostHog(components.posthog, {
  host: posthogEnvironment.host,
});
