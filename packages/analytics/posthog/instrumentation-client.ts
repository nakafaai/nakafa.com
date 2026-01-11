import { keys } from "@repo/analytics/keys";
import posthog from "posthog-js";

export const initializeAnalytics = () => {
  posthog.init(keys().NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: keys().NEXT_PUBLIC_POSTHOG_HOST,
    defaults: "2025-11-30",
  });
};
