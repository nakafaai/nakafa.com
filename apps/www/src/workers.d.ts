/**
 * The runtime module of the Cloudflare Worker, which Alchemy's Cloudflare plugin
 * resolves in workerd. Node has no such module, so only its declaration lives here.
 */
declare module "cloudflare:workers" {
  /** Keeps the Worker running until the promise settles, after the response is sent. */
  export function waitUntil(promise: Promise<unknown>): void;
}
