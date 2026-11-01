import { Effect } from "effect";
import { STALE_FUNCTION_MESSAGE } from "@/lib/chunks/stale";
import { isServerFunctionPath } from "@/lib/routing/template";

/** The message Start throws for a server function id that this release does not hold. */
const UNKNOWN_FUNCTION = "Server function info not found for ";

/** The status of a server function that a deploy removed: gone, not a failure. */
const GONE = 410;

/**
 * Answers a call to a server function of an earlier release as gone. Start reads
 * the id before it opens its own error handling and answers 500, so a tab from
 * before a deploy would read as a server failure in the logs. The browser reloads
 * for this answer as it does for a missing chunk (`recoverStaleFunction`).
 */
export const answerStaleFunction = Effect.fn("www.chunks.answerStaleFunction")(
  function* (request: Request, response: Response) {
    if (
      response.status !== 500 ||
      !isServerFunctionPath(new URL(request.url).pathname)
    ) {
      return response;
    }
    const body = yield* Effect.promise(() => response.clone().text());
    return body.includes(UNKNOWN_FUNCTION)
      ? new Response(STALE_FUNCTION_MESSAGE, {
          headers: {
            "cache-control": "no-store",
            "content-type": "text/plain",
          },
          status: GONE,
        })
      : response;
  }
);
