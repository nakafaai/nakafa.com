import { PostHog } from "@posthog/convex";
import { posthogEnvironment } from "@repo/backend/confect/modules/integrations/posthog.env";
import { components } from "@repo/backend/convex/_generated/api";

/** PostHog Convex component adapter. */
export const posthog = new PostHog(components.posthog, {
  host: posthogEnvironment.host,
});
