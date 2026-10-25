import { reportUncaughtRequestError } from "@repo/analytics/server-reporting";
import {
  createServerEntry,
  createStartHandler,
  defaultStreamHandler,
  handleStartError,
} from "@tanstack/react-start/server";
import { Effect } from "effect";
import { answerRequest } from "@/lib/routing/answer.server";
import { logRouteFailures } from "@/lib/routing/failures.server";
import "@/lib/server/runtime";
import { attachStaticCalls } from "@/lib/static/record.server";
import { withPageHeaders } from "@/lib/tenant/gate";

/**
 * Renders the route tree after the router loads it. The router answers a failed
 * route with its own error page, so the log of each failed route is written here.
 */
const startHandler = createStartHandler((context) => {
  Effect.runSync(logRouteFailures(context.router.stores.matches.get()));
  return defaultStreamHandler(context);
});

/**
 * Start's server entry. The address and the headers decide each answer before the
 * router sees the request, in the order that `answerRequest` names. Only then does
 * the router answer, and every page and not-found answer carries the page headers.
 * Route errors are handled by the router. Only an error that escapes a decision
 * reaches the catch, which reports it and answers with Start's error response.
 *
 * https://tanstack.com/start/latest/docs/framework/react/guide/server-entry-point
 */
export default createServerEntry({
  fetch(request, opts) {
    // The default runtime runs this answer because it requires no services from
    // its caller: every layer that the answer uses is provided where it is used.
    return Effect.runPromise(
      answerRequest(request, async (routed) => startHandler(routed, opts)).pipe(
        Effect.catchTag("UncaughtRequestError", (error) =>
          reportUncaughtRequestError(error.cause, request).pipe(
            Effect.as(handleStartError(error.cause))
          )
        ),
        Effect.flatMap((response) => attachStaticCalls(request, response)),
        Effect.map((response) => withPageHeaders(request, response))
      )
    );
  },
});
