/**
 * The runtime module of the Cloudflare Worker, which Alchemy's Cloudflare plugin
 * resolves in workerd. Node has no such module, so only its declaration lives here.
 */
declare module "cloudflare:workers" {
  /** Keeps the Worker running until the promise settles, after the response is sent. */
  export function waitUntil(promise: Promise<unknown>): void;

  /** The bindings of this Worker. `ASSETS` serves the static files that the build wrote. */
  export const env: {
    readonly ASSETS: {
      readonly fetch: (request: Request) => Promise<Response>;
    };
  };
}
