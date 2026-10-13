import { PostHog } from "@posthog/convex";

/**
 * Stands in for the queue that carries an exception to error tracking. The
 * spy counts what a test sends to it, and the queue accepts everything.
 */
export const stubReport = () =>
  vi.spyOn(PostHog.prototype, "captureException").mockResolvedValue(undefined);
