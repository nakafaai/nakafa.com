import { FetchClient } from "@repo/utilities/http/client";
import { Effect, Option, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import { runServerEffect } from "@/lib/server/fn";
import { CONVEX_SITE_URL } from "@/lib/server/runtime";
import {
  ForwardedMethod,
  forwardedBody,
  forwardedRequestHeaders,
  forwardedResponseHeaders,
  schoolApiTarget,
} from "@/lib/tenant/api";

/** The answer of a school path on a host that names no school. */
const NOT_FOUND = () => new Response(null, { status: 404 });

/** Whether a request's method is one that a forward sends on. */
const isForwardedMethod = Schema.is(ForwardedMethod);

/** The answer of a method that no forward sends on. */
const NOT_ALLOWED = () => new Response(null, { status: 405 });

/**
 * Forwards one request of a school host's REST API or MCP server to the Convex site of its
 * cell (ADR 0029). The forward keeps the bearer token and drops the cookie, because the school API
 * takes a token and never a session, and it adds no secret: the Convex route checks the
 * token itself. The body is read once and sent as it came, and no redirect is followed.
 * This is a framework seam (a server route), because the Worker is the only process that
 * receives the school host's request.
 */
const forward = Effect.fn("www.tenant.api.forward")(
  function* (request: Request) {
    const siteUrl = yield* CONVEX_SITE_URL;
    const target = schoolApiTarget(request, siteUrl);
    if (Option.isNone(target)) {
      return NOT_FOUND();
    }
    const { method } = request;
    if (!isForwardedMethod(method)) {
      return NOT_ALLOWED();
    }
    const body = yield* forwardedBody(request);
    const client = (yield* HttpClient.HttpClient).pipe(HttpClient.withScope);
    const answer = yield* client.execute(
      HttpClientRequest.make(method)(target.value, {
        body,
        headers: forwardedRequestHeaders(request.headers),
      })
    );
    const bytes = yield* answer.arrayBuffer;
    return new Response(bytes, {
      headers: forwardedResponseHeaders(answer.headers),
      status: answer.status,
    });
  },
  Effect.scoped,
  Effect.provide(FetchClient)
);

/** Answers one school API or MCP request of a school host, or not found on any other host. */
export function forwardSchoolApiRequest(request: Request): Promise<Response> {
  return runServerEffect(forward(request).pipe(Effect.orDie));
}
