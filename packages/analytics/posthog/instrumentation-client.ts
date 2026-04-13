import { keys } from "@repo/analytics/keys";
import { POSTHOG_PROXY_PATH } from "@repo/analytics/posthog/config";
import posthog from "posthog-js";

/**
 * Initialize the browser PostHog client against the app's same-origin proxy.
 *
 * References:
 * https://posthog.com/docs/libraries/next-js
 * https://posthog.com/docs/advanced/proxy/nextjs
 */
export const initializeAnalytics = () => {
  posthog.init(keys().NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: POSTHOG_PROXY_PATH,
    ui_host: keys().NEXT_PUBLIC_POSTHOG_UI_HOST,
    capture_exceptions: {
      capture_console_errors: true,
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
    },
    defaults: "2026-01-30",
  });
};
