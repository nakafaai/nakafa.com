const POSTHOG_DEFAULT_HOST = "https://eu.i.posthog.com";

/** Environment values used by the PostHog Convex component boundary. */
export const posthogEnvironment = {
  host: process.env.POSTHOG_HOST?.trim() || POSTHOG_DEFAULT_HOST,
};
