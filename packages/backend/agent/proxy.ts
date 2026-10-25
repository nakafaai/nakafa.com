import {
  type AgentEdgeContract,
  NAKAFA_EDGE_RELEASE_SHA_HEADER,
  NAKAFA_RELEASE_SHA_ENVIRONMENT,
} from "@repo/backend/agent/edge";
import {
  type AgentEdgePath,
  agentEdgeOriginPath,
  agentEdgeRequestHeaders,
} from "@repo/backend/agent/route";
import { FetchClient } from "@repo/utilities/http/client";
import { Data, Effect } from "effect";
import {
  FetchHttpClient,
  HttpBody,
  HttpClient,
  HttpClientRequest,
  HttpMethod,
  HttpServerResponse,
} from "effect/http";

/** The Worker lacks one binding that it must read, so it refuses to forward. */
export class AgentEdgeBindingError extends Data.TaggedError(
  "AgentEdgeBindingError"
)<{
  readonly binding: string;
}> {}

/** The protected origin did not answer, so the public request cannot complete. */
export class AgentEdgeUpstreamError extends Data.TaggedError(
  "AgentEdgeUpstreamError"
)<{
  readonly cause: unknown;
}> {}

/** The bindings of one edge Worker, keyed by the names the contract declares. */
type AgentEdgeBindings = Readonly<Record<string, string | undefined>>;

function readBinding(bindings: AgentEdgeBindings, name: string) {
  const value = bindings[name];
  if (value === undefined || value === "") {
    return Effect.fail(new AgentEdgeBindingError({ binding: name }));
  }
  return Effect.succeed(value);
}

/**
 * Forwards one public request to the protected origin path that the contract
 * declares. The origin keeps the query string and receives the edge secret, and
 * the response names the release that served it.
 */
export const forwardAgentEdge = Effect.fn("agent.edge.forward")(function* (
  contract: AgentEdgeContract,
  paths: readonly AgentEdgePath[],
  request: Request,
  bindings: AgentEdgeBindings
) {
  const url = new URL(request.url);
  const originPath = agentEdgeOriginPath(contract, paths, url.pathname);
  if (originPath === undefined) {
    return new Response(null, { status: 404 });
  }
  const method = request.method;
  if (!HttpMethod.isHttpMethod(method)) {
    return new Response(null, { status: 405 });
  }

  const origin = yield* readBinding(bindings, contract.originEnvironment);
  const secret = yield* readBinding(bindings, contract.secretEnvironment);
  const releaseSha = yield* readBinding(
    bindings,
    NAKAFA_RELEASE_SHA_ENVIRONMENT
  );

  const target = new URL(`${originPath}${url.search}`, origin);
  const upstream = yield* HttpClient.execute(
    HttpClientRequest.make(method)(target, {
      // Effect deletes a Content-Type header that its body does not name, so the
      // body carries the caller's media type and the origin sees it.
      body:
        request.body === null
          ? HttpBody.empty
          : HttpBody.raw(request.body, {
              contentType: request.headers.get("content-type") ?? undefined,
            }),
      headers: agentEdgeRequestHeaders(request.headers, contract, secret),
    })
  ).pipe(
    // A redirect returns to the caller unfollowed. Only Fetch honors this option.
    Effect.provideService(FetchHttpClient.RequestInit, { redirect: "manual" }),
    Effect.mapError((cause) => new AgentEdgeUpstreamError({ cause }))
  );

  const headers = new Headers(upstream.headers);
  headers.set(NAKAFA_EDGE_RELEASE_SHA_HEADER, releaseSha);
  return HttpServerResponse.toWeb(
    HttpServerResponse.stream(upstream.stream, {
      headers,
      status: upstream.status,
    })
  );
});

/**
 * The fetch handler of one edge Worker. A missing binding answers as a
 * configuration error, and an unreachable origin answers as a bad gateway.
 * Neither response names a binding or the origin URL.
 */
export function agentEdgeWorker(
  contract: AgentEdgeContract,
  paths: readonly AgentEdgePath[]
) {
  return {
    fetch(request: Request, bindings: AgentEdgeBindings): Promise<Response> {
      return Effect.runPromise(
        forwardAgentEdge(contract, paths, request, bindings).pipe(
          Effect.provide(FetchClient),
          Effect.catchTags({
            AgentEdgeBindingError: () =>
              Effect.succeed(
                new Response("The edge is not configured.", { status: 500 })
              ),
            AgentEdgeUpstreamError: () =>
              Effect.succeed(
                new Response("The origin is unavailable.", { status: 502 })
              ),
          })
        )
      );
    },
  };
}
