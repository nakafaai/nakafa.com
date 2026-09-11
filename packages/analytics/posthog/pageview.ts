import type { PostHog } from "posthog-js";

export type PageviewCaptureClient = Pick<PostHog, "capture">;

export interface PageviewWindow {
  addEventListener: (type: "popstate", listener: () => void) => void;
  readonly history: Pick<History, "pushState" | "replaceState">;
  readonly location: Pick<Location, "href">;
}

/**
 * Captures one pageview now and on every subsequent history navigation.
 *
 * Explicit tracking replaces the SDK automatic pageview so each capture lands
 * exactly once, after identity is known: no duplicates on consent transitions
 * and no anonymous-then-identified double count for one view. Same-href
 * replacements are skipped. Runs for the application lifetime; the provider
 * never restarts it.
 */
export function startPageviewTracking(
  source: PageviewWindow,
  client: PageviewCaptureClient
) {
  let lastHref = source.location.href;
  const notify = () => {
    const href = source.location.href;
    if (href === lastHref) {
      return;
    }
    lastHref = href;
    client.capture("$pageview");
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
  client.capture("$pageview");
}
