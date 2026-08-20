import { initializeAnalytics } from "@repo/analytics/posthog/instrumentation-client";

if (process.env.NEXT_PUBLIC_AKSARA_PREVIEW_CHILD !== "true") {
  initializeAnalytics();
}
