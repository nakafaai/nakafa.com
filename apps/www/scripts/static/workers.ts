/**
 * The build's stand-in for the `cloudflare:workers` module. The static runner
 * executes the app's modules in Node, which has no Worker: a background promise
 * there has no request to outlive, so it runs to its end.
 */
export function waitUntil(_promise: Promise<unknown>): void {
  // The build has no request to keep alive, so nothing waits for the promise.
}
