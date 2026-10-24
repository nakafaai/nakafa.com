/**
 * Runs `warm` in the browser's idle time and returns the function that cancels
 * it. A browser without idle callbacks, such as Safari, runs `warm` at once and has
 * nothing to cancel.
 */
export function warmWhenIdle(warm: () => void): (() => void) | undefined {
  if (!("requestIdleCallback" in window)) {
    warm();
    return undefined;
  }
  const handle = window.requestIdleCallback(warm);
  return () => window.cancelIdleCallback(handle);
}
