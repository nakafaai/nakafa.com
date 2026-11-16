import { Effect } from "effect";
import { answerRequest } from "@/lib/routing/answer.server";
import type { RouterHandler } from "@/lib/routing/routed.server";

/**
 * The helpers of the server entry's tests, which only those tests load: a router
 * that records its requests, and the entry's answer to one address through it. The
 * test file mocks the entry's readers before this module loads the entry.
 */

export const ORIGIN = "https://nakafa.com";

/** A router that answers the HTML page, and records each request it receives. */
export function router() {
  return vi.fn<RouterHandler>(() =>
    Promise.resolve(
      new Response("<html>page</html>", {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    )
  );
}

/** Answers one request through the entry's decisions, with the given router. */
export function answer(
  address: string,
  options: { readonly headers?: Record<string, string> } = {},
  handle = router()
) {
  return answerRequest(
    new Request(`${ORIGIN}${address}`, {
      headers: new Headers(options.headers),
    }),
    handle
  );
}

/** Answers one request and returns the answer with the router that received it. */
export function served(
  address: string,
  options: { readonly headers?: Record<string, string> } = {}
) {
  const handle = router();
  return Effect.map(answer(address, options, handle), (response) => ({
    handle,
    response,
  }));
}

/** The request that the router received in its single call. */
export function routedRequest(handle: ReturnType<typeof router>) {
  const [request] = handle.mock.calls[0] ?? [];
  return request;
}

/** The not-found page that the router received with its single call, if any. */
export function routedNotFound(handle: ReturnType<typeof router>) {
  const [, notFound] = handle.mock.calls[0] ?? [];
  return notFound;
}
