import "@tanstack/react-start/server-only";

import { mergeVaryHeader } from "@repo/utilities/http/accept";
import { Array as Arr, Effect, Match, Option } from "effect";
import { answerLlmsMarkdown } from "@/lib/llms/markdown.server";
import {
  isLocalizedLlmsRoute,
  LLMS_REPRESENTATION_VARY_FIELDS,
  type LlmsProxyRouteDecision,
  resolveLlmsProxyRoute,
} from "@/lib/llms/routes";

/** Answers 406 to a representation the site cannot send, naming the fields it varies by. */
function representationNotAcceptable() {
  return new Response("Not Acceptable\n", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      Vary: Arr.join(LLMS_REPRESENTATION_VARY_FIELDS, ", "),
    },
    status: 406,
  });
}

/**
 * Adds the representation fields to the Vary of a localized document answer. The
 * values that the answer already has keep their place, and a field is added only
 * once. The agent discovery links belong to every page, so the route rules of the
 * app set them on each response, and a document answer does not add them again.
 */
function withRepresentationVary(response: Response) {
  const headers = new Headers(response.headers);
  headers.set(
    "Vary",
    mergeVaryHeader(
      Option.fromNullishOr(headers.get("Vary")),
      LLMS_REPRESENTATION_VARY_FIELDS
    )
  );
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

/** Answers the Markdown of a localized route, or the 406 of a representation the site cannot send. */
function answerDecision(decision: LlmsProxyRouteDecision) {
  return Match.value(decision).pipe(
    Match.discriminatorsExhaustive("kind")({
      delegate: () => Effect.succeedNone,
      "not-acceptable": () => Effect.succeedSome(representationNotAcceptable()),
      "rewrite-markdown": ({ localizedRoute }) =>
        answerLlmsMarkdown({
          cleanSlug: localizedRoute.route.slice(1),
          hasLocalePrefix: true,
          locale: localizedRoute.locale,
        }).pipe(
          Effect.map((response) =>
            Option.some(withRepresentationVary(response))
          )
        ),
    })
  );
}

/**
 * Negotiates one request before the router runs. An agent that asks for
 * Markdown gets it, a representation that the site cannot send gets 406, and
 * every other request reaches `respond`, the router's answer, which may fail with
 * its own error. A localized document answer, Markdown or HTML, carries the
 * representation fields in `Vary`, whichever representation it is.
 */
export const negotiateDocument = Effect.fn("www.llms.negotiateDocument")(
  function* <E>(request: Request, respond: Effect.Effect<Response, E>) {
    const url = new URL(request.url);
    const decision: LlmsProxyRouteDecision = yield* resolveLlmsProxyRoute({
      acceptHeader: Option.fromNullishOr(request.headers.get("Accept")),
      method: request.method,
      pathname: url.pathname,
    });
    const answer = yield* answerDecision(decision);
    if (Option.isSome(answer)) {
      return answer.value;
    }
    const response = yield* respond;
    return isLocalizedLlmsRoute(url.pathname)
      ? withRepresentationVary(response)
      : response;
  }
);
