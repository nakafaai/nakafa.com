import { runWithCodec } from "@confect/core/Ref";
import connectors from "@repo/backend/confect/_generated/refs/connectors";
import { ConvexHttpClient } from "convex/browser";
import { Data, Effect, Option } from "effect";
import { readRequestToken } from "@/lib/auth/session.server";
import { CONVEX_URL } from "@/lib/server/runtime";

/** Convex did not answer the connect's finish: the network or the server failed. */
class FinishUnanswered extends Data.TaggedError("FinishUnanswered") {}

/** A redirect that no cache keeps, because it carries one user's connect. */
const redirectTo = (location: URL) =>
  new Response(null, {
    headers: { "cache-control": "private, no-store", location: location.href },
    status: 302,
  });

/**
 * Finishes a Google connect at the one callback of the site (ADR 0015). The
 * server takes the code and the state with the visitor's own Convex token, and
 * redirects to the address it answers, the page the connect started from, with
 * the outcome in `connect`. The address comes from the server, never from a
 * parameter, so the callback redirects nowhere else. A callback without a state,
 * without a session, whose connect expired, or whose finish Convex did not
 * answer goes to the site's home.
 */
export const serveConnectCallback = Effect.fn("www.connectors.callback")(
  function* (request: Request) {
    const url = new URL(request.url);
    const home = new URL("/", url.origin);
    const state = url.searchParams.get("state");
    const token = yield* readRequestToken(request).pipe(
      Effect.orElseSucceed(() => undefined)
    );
    if (state === null || token === undefined) {
      return redirectTo(home);
    }
    const client = new ConvexHttpClient(yield* CONVEX_URL);
    client.setAuth(token);
    const finished = yield* runWithCodec(
      connectors.google.finish,
      { code: url.searchParams.get("code"), state },
      (reference, args) => client.action(reference, args),
      () => new FinishUnanswered()
    ).pipe(Effect.option);
    return Option.match(finished, {
      onNone: () => redirectTo(home),
      onSome: (answer) => {
        const location = new URL(answer.location);
        location.searchParams.set("connect", answer.outcome);
        return redirectTo(location);
      },
    });
  }
);
