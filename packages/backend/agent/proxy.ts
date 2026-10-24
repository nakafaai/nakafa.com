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
import { Data, Effect } from "effect";
import { FetchHttpClient } from "effect/http";

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
export type AgentEdgeBindings = Readonly<Record<string, string | undefined>>;

/** One edge Worker's contract and the public paths that it owns. */
export interface AgentEdgeOptions {
  readonly contract: AgentEdgeContract;
  readonly paths: readonly AgentEdgePath[];
}

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
  options: AgentEdgeOptions,
  request: Request,
  bindings: AgentEdgeBindings
) {
  const { contract, paths } = options;
  const url = new URL(request.url);
  const originPath = agentEdgeOriginPath(contract, paths, url.pathname);
  if (originPath === undefined) {
    return new Response(null, { status: 404 });
  }

  const origin = yield* readBinding(bindings, contract.originEnvironment);
  const secret = yield* readBinding(bindings, contract.secretEnvironment);
  const releaseSha = yield* readBinding(
    bindings,
    NAKAFA_RELEASE_SHA_ENVIRONMENT
  );

  const target = new URL(`${originPath}${url.search}`, origin);
  const init: RequestInit & { duplex: "half" } = {
    method: request.method,
    headers: agentEdgeRequestHeaders(request.headers, contract, secret),
    body: request.body,
    redirect: "manual",
    duplex: "half",
  };
  const fetcher = yield* FetchHttpClient.Fetch;
  const upstream = yield* Effect.tryPromise({
    try: () => fetcher(target, init),
    catch: (cause) => new AgentEdgeUpstreamError({ cause }),
  });

  const headers = new Headers(upstream.headers);
  headers.set(NAKAFA_EDGE_RELEASE_SHA_HEADER, releaseSha);
  return new Response(upstream.body, {
    headers,
    status: upstream.status,
    statusText: upstream.statusText,
  });
});

/**
 * The fetch handler of one edge Worker. A missing binding answers as a
 * configuration error, and an unreachable origin answers as a bad gateway.
 * Neither response names a binding or the origin URL.
 */
export function agentEdgeWorker(options: AgentEdgeOptions) {
  return {
    fetch(request: Request, bindings: AgentEdgeBindings): Promise<Response> {
      return Effect.runPromise(
        forwardAgentEdge(options, request, bindings).pipe(
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
