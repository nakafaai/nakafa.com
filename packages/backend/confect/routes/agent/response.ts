import type { AgentHttpInputError } from "@repo/backend/confect/routes/agent/input";
import type { AgentRateLimitError } from "@repo/backend/confect/routes/agent/quota";
import type {
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/agent/errors";
import type { NakafaProblemDetails } from "@repo/contents/agent/schema/api";
import { encodeJsonText } from "@repo/utilities/json";
import { type Cause, Effect, Schema } from "effect";

const AgentProblemStatusSchema = Schema.Literals([
  400, 403, 404, 405, 406, 415, 422, 429, 500, 503,
]);
const PUBLIC_API_HEADERS = {
  "Access-Control-Allow-Headers":
    "Accept, Content-Type, traceparent, tracestate, baggage",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers": "Retry-After",
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  Vary: "Accept, Accept-Encoding",
} as const;
const HeadersInitSchema = Schema.Union([
  Schema.mutable(
    Schema.Array(Schema.mutable(Schema.Tuple([Schema.String, Schema.String])))
  ),
  Schema.Record(Schema.String, Schema.String),
  Schema.instanceOf(Headers),
]);
const ProblemInputSchema = Schema.Struct({
  code: Schema.String,
  detail: Schema.String,
  headers: Schema.optionalKey(HeadersInitSchema),
  instance: Schema.String,
  requestId: Schema.String,
  resolution: Schema.String,
  status: AgentProblemStatusSchema,
  title: Schema.String,
  type: Schema.String,
});
type ProblemInput = typeof ProblemInputSchema.Type;

/** Returns a no-store JSON response with the public CORS contract. */
export function agentJsonResponse(
  body: unknown,
  status = 200,
  headers?: HeadersInit
) {
  return new Response(body === undefined ? undefined : encodeJsonText(body), {
    headers: {
      ...PUBLIC_API_HEADERS,
      ...headers,
    },
    status,
  });
}

/** Returns one RFC 9457 response with stable machine recovery fields. */
export function problemResponse(input: ProblemInput) {
  const body: NakafaProblemDetails = {
    code: input.code,
    detail: input.detail,
    instance: input.instance,
    request_id: input.requestId,
    resolution: input.resolution,
    status: input.status,
    title: input.title,
    type: new URL(`/problems/${input.type}`, "https://nakafa.com").href,
  };
  return agentJsonResponse(body, input.status, {
    ...input.headers,
    "Content-Type": "application/problem+json; charset=utf-8",
  });
}

/** Maps typed agent-domain failures to public Problem Details. */
export function agentFailureResponse(
  error: AgentRateLimitError | NakafaAgentDataReadError | NakafaAgentInputError,
  instance: string,
  requestId: string
) {
  if (error._tag === "AgentRateLimitError") {
    return problemResponse({
      code: "RATE_LIMITED",
      detail: "The client exceeded the bounded public read quota.",
      headers: {
        "Retry-After": Math.max(
          1,
          Math.ceil(error.retryAfterMs / 1000)
        ).toString(),
      },
      instance,
      requestId,
      resolution: "Wait for Retry-After, then retry with backoff.",
      status: 429,
      title: "Too many requests",
      type: "rate-limited",
    });
  }
  if (error._tag === "NakafaAgentInputError") {
    return problemResponse({
      code: "UNPROCESSABLE_REQUEST",
      detail: typeof error.cause === "string" ? error.cause : error.message,
      instance,
      requestId,
      resolution: error.message,
      status: 422,
      title: "Unprocessable request",
      type: "unprocessable-request",
    });
  }
  return problemResponse({
    code: "SERVICE_UNAVAILABLE",
    detail: error.message,
    instance,
    requestId,
    resolution: "Retry the request later using the same documented inputs.",
    status: 503,
    title: "Service unavailable",
    type: "service-unavailable",
  });
}

/** Maps malformed HTTP parameters to a correctable public error. */
export function httpInputFailureResponse(
  error: AgentHttpInputError,
  instance: string,
  requestId: string
) {
  return problemResponse({
    code: "INVALID_REQUEST",
    detail: error.detail,
    instance,
    requestId,
    resolution: error.resolution,
    status: 400,
    title: "Invalid request",
    type: "invalid-request",
  });
}

/** Maps an unexpected Effect defect to a traceable server response. */
function internalFailureResponse(instance: string, requestId: string) {
  return problemResponse({
    code: "INTERNAL_ERROR",
    detail: "The public API could not complete the request.",
    instance,
    requestId,
    resolution: "Retry later and include request_id when contacting support.",
    status: 500,
    title: "Internal server error",
    type: "internal-error",
  });
}

/** Logs one unexpected private cause before returning its traceable response. */
export const logInternalFailure = Effect.fn("agent.logInternalFailure")(
  function* (cause: Cause.Cause<unknown>, instance: string, requestId: string) {
    yield* Effect.logError("Unexpected Nakafa public API failure.", cause).pipe(
      Effect.annotateLogs({
        instance,
        requestId,
      })
    );
    return internalFailureResponse(instance, requestId);
  }
);

/** Returns the shared successful CORS preflight response. */
export function agentOptionsResponse() {
  return new Response(null, {
    headers: PUBLIC_API_HEADERS,
    status: 204,
  });
}
