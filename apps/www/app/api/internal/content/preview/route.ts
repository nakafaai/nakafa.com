import { Effect } from "effect";
import { openPreviewEvents } from "@/lib/content/preview/events";

/** Maps a disabled preview child to an intentionally unavailable endpoint. */
function unavailableResponse() {
  return new Response(null, {
    headers: { "cache-control": "private, no-store" },
    status: 404,
  });
}

/** Maps provider/config failures without exposing local connection details. */
function failureResponse() {
  return new Response(null, {
    headers: { "cache-control": "private, no-store" },
    status: 502,
  });
}

/** Selects the intentionally unavailable or provider-failure response. */
function mapFailure(error: { readonly _tag: string }) {
  if (error._tag === "PreviewUnavailableError") {
    return unavailableResponse();
  }

  return failureResponse();
}

/** Proxies sanitized local preview updates without exposing provider secrets. */
export function GET(request: Request) {
  return Effect.runPromise(
    openPreviewEvents(request.signal).pipe(
      Effect.match({
        onFailure: mapFailure,
        onSuccess: (stream) =>
          new Response(stream, {
            headers: {
              "cache-control": "private, no-cache, no-store",
              connection: "keep-alive",
              "content-type": "text/event-stream; charset=utf-8",
            },
          }),
      })
    )
  );
}
