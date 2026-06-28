import { afterEach, vi } from "vitest";

// @posthog/convex reads component env from process.env under convex-test.
// Override shell env so tests never send real analytics events.
// @see https://docs.convex.dev/components/authoring#environment-variables
process.env.POSTHOG_HOST = "http://127.0.0.1:9";
process.env.POSTHOG_PROJECT_TOKEN = "phc_test";

/** Restores real timers after every backend test to prevent timer leakage. */
afterEach(() => {
  vi.useRealTimers();
});
