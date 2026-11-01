import {
  createSsrStreamResponse,
  defineHandlerCallback,
  getSsrStatus,
  transformReadableStreamWithRouter,
} from "@tanstack/react-router/ssr/server";
import { StartServer } from "@tanstack/react-start/server";
import { Effect } from "effect";
import { renderToReadableStream } from "react-dom/server";

/**
 * Renders a page whole: React draws every boundary before the first byte is
 * read, so the browser never paints half a document, and a part that finishes
 * after the shell, such as a chart, stays inside its article instead of landing
 * at the page's end for the browser's script to move. Start's own handler waits for every boundary
 * only for a crawler, and only after its transform has begun to read the page,
 * which flushes the shell first (`renderRouterToStream` in
 * `@tanstack/react-router` 1.170.46).
 */
export const renderWholePage = defineHandlerCallback(
  ({ request, responseHeaders, router }) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const page = yield* Effect.promise(() =>
          renderToReadableStream(<StartServer router={router} />, {
            progressiveChunkSize: Number.POSITIVE_INFINITY,
            signal: request.signal,
          })
        );
        yield* Effect.promise(() => page.allReady);
        const body = transformReadableStreamWithRouter(router, page, {
          rendererSafePoint: "script-close",
          signal: request.signal,
        });
        return createSsrStreamResponse(
          router,
          new Response(body, {
            headers: responseHeaders,
            status: getSsrStatus(router),
          })
        );
      }).pipe(
        Effect.onError(() => Effect.sync(() => router.serverSsr?.cleanup()))
      )
    )
);
