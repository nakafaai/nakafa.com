import type { PostHog } from "posthog-js";

export type PageviewCaptureClient = Pick<PostHog, "capture">;

export interface PageviewWindow {
  addEventListener: (type: "popstate", listener: () => void) => void;
  readonly history: Pick<History, "pushState" | "replaceState">;
  readonly location: Pick<Location, "href">;
}

/**
 * Installs explicit history navigation tracking for one client.
 *
 * The landing view is intentionally not captured here: it fires on the first
 * settled admission (see browser analytics transitions) so the counted view
 * carries the resolved identity instead of a premature anonymous baseline.
 * Same-href replacements are skipped. Runs for the application lifetime; the
 * provider never restarts it.
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
}
