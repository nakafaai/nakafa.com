import { afterEach, vi } from "vitest";

// @posthog/convex reads component env from process.env under convex-test.
// Override shell env so tests never send real analytics events.
// @see https://docs.convex.dev/components/authoring#environment-variables
process.env.POSTHOG_HOST = "http://127.0.0.1:9";
process.env.POSTHOG_ERASURE_API_KEY = "phx_test";
process.env.POSTHOG_PROJECT_ID = "114144";
process.env.POSTHOG_PROJECT_TOKEN = "phc_test";
process.env.CONVEX_SITE_URL = "https://example.convex.site";
process.env.POLAR_ACCESS_TOKEN = "polar_test";
process.env.POLAR_WEBHOOK_SECRET = "polar_webhook_test";
process.env.RESEND_API_KEY = "re_test_welcome_delivery";

/** Restores real timers after every backend test to prevent timer leakage. */
afterEach(() => {
  vi.useRealTimers();
});
