import { keys } from "@repo/analytics/keys";
import posthog from "posthog-js";

export const initializeAnalytics = () => {
  posthog.init(keys().NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: keys().NEXT_PUBLIC_POSTHOG_API_HOST,
    ui_host: keys().NEXT_PUBLIC_POSTHOG_UI_HOST,
    capture_exceptions: {
      capture_console_errors: true,
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
    },
    defaults: "2026-01-30",
  });
};
