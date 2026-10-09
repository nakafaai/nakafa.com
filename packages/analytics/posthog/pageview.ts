import { Context, Effect } from "effect";
import type { PostHog } from "posthog-js";

type PageviewCaptureClient = Pick<PostHog, "capture">;

/** Browser window members that pageview tracking reads and patches. */
export class PageviewWindow extends Context.Service<
  PageviewWindow,
  {
    addEventListener: (type: "popstate", listener: () => void) => void;
    readonly history: Pick<History, "pushState" | "replaceState">;
    readonly location: Pick<Location, "href">;
  }
>()("@repo/analytics/posthog/pageview/PageviewWindow") {}

/**
 * Installs explicit history navigation tracking for one client.
 *
 * The landing view is deferred to the first settled admission so it carries
 * the resolved identity. A navigation that lands first counts instead and
 * reports through `onHistoryCapture`, so the admission never recounts the
 * same destination. Same-href replacements are skipped; runs for the
 * application lifetime.
 */
export const startPageviewTracking = Effect.fn(
  "Analytics.startPageviewTracking"
)(function* (client: PageviewCaptureClient, onHistoryCapture?: () => void) {
  const source = yield* PageviewWindow;
  let lastHref = source.location.href;
  const notify = () => {
    const href = source.location.href;
    if (href === lastHref) {
      return;
    }
    lastHref = href;
    client.capture("$pageview");
    onHistoryCapture?.();
  };

  const { history } = source;
  const originalPush = history.pushState.bind(history);
  const originalReplace = history.replaceState.bind(history);
  history.pushState = (...args: Parameters<History["pushState"]>) => {
    originalPush(...args);
    notify();
  };
  history.replaceState = (...args: Parameters<History["replaceState"]>) => {
    originalReplace(...args);
    notify();
  };
  source.addEventListener("popstate", notify);
});
