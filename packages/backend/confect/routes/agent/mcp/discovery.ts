import { Effect, Option, Schema } from "effect";

/** The capabilities Nakafa serves: tools, resources, and prompts, none with options. */
export const NAKAFA_CAPABILITIES = { prompts: {}, resources: {}, tools: {} };

/** The capabilities a school serves: tools only (ADR 0029). */
export const SCHOOL_CAPABILITIES = { tools: {} };

/** A discovery request, identified by its method. */
const DiscoveryRequest = Schema.Struct({
  method: Schema.Literal("server/discover"),
});

/** A JSON object whose members keep their order through a decode and an encode. */
const JsonObject = Schema.fromJsonString(
  Schema.Record(Schema.String, Schema.Unknown)
);

/** A successful discovery answer: its result has a capabilities member. */
const DiscoveryAnswer = Schema.Struct({
  result: Schema.Struct({ capabilities: Schema.Unknown }),
});

/**
 * Replaces the capabilities of a successful discovery answer with the ones the
 * server serves. The engine declares capabilities for every server, so the route
 * corrects this one member; no other member changes. Any other answer, and any
 * body that does not decode, is returned as the same response.
 */
export const withDiscoveryCapabilities = Effect.fn(
  "agent.mcp.withDiscoveryCapabilities"
)(function* (
  requestBody: unknown,
  response: Response,
  capabilities: Readonly<Record<string, object>>
) {
  if (!Schema.is(DiscoveryRequest)(requestBody)) {
    return response;
  }
  const text = yield* Effect.promise(() => response.clone().text());
  const decoded = Schema.decodeOption(JsonObject)(text);
  if (Option.isNone(decoded) || !Schema.is(DiscoveryAnswer)(decoded.value)) {
    return response;
  }
  const answer = decoded.value;
  const body = yield* Schema.encodeEffect(JsonObject)({
    ...answer,
    result: { ...answer.result, capabilities },
  }).pipe(Effect.orDie);
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
});
