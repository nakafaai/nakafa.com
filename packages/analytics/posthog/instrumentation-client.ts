import { keys } from "@repo/analytics/keys";
import { POSTHOG_PROXY_PATH } from "@repo/analytics/posthog/config";
import {
  filterAuthorizedAnalyticsEvent,
  revokeAnalyticsIdentity,
} from "@repo/analytics/posthog/identity";
import posthog from "posthog-js";

interface AnalyticsIdentityClient {
  get_property(key: string): unknown;
  has_opted_out_capturing(): boolean;
  opt_out_capturing(): void;
  reset(): void;
}

/** Removes a persisted identified user before the SDK's initial pageview. */
export function resetPersistedAnalyticsIdentity(
  client: AnalyticsIdentityClient
) {
  if (typeof client.get_property("$user_id") !== "string") {
    return;
  }

  const wasOptedOut = client.has_opted_out_capturing();
  client.reset();

  if (wasOptedOut) {
    client.opt_out_capturing();
  }
}

/**
 * Initialize the browser PostHog client against the app's same-origin proxy.
 *
 * References:
 * https://posthog.com/docs/libraries/next-js
 * https://posthog.com/docs/advanced/proxy/nextjs
 */
export const initializeAnalytics = () => {
  revokeAnalyticsIdentity();

  posthog.init(keys().NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: POSTHOG_PROXY_PATH,
    before_send: filterAuthorizedAnalyticsEvent,
    ui_host: keys().NEXT_PUBLIC_POSTHOG_UI_HOST,
    capture_exceptions: {
      capture_console_errors: true,
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
    },
    defaults: "2026-01-30",
    loaded: resetPersistedAnalyticsIdentity,
  });
};
