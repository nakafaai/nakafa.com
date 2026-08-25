import type { AgentHttpInputError } from "@repo/backend/convex/routes/agent/input";
import type {
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/_lib/agent/errors";
import type { NakafaProblemDetails } from "@repo/contents/_lib/agent/schema/api";

export type AgentProblemStatus =
  | 400
  | 403
  | 404
  | 405
  | 406
  | 415
  | 422
  | 429
  | 500
  | 503;

export const PUBLIC_API_MEDIA_TYPE = "application/json; charset=utf-8";

export const PUBLIC_API_HEADERS = {
  "Access-Control-Allow-Headers":
    "Accept, Content-Type, traceparent, tracestate, baggage",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers": "Retry-After",
  "Cache-Control": "no-store",
  "Content-Type": PUBLIC_API_MEDIA_TYPE,
  Vary: "Accept, Accept-Encoding, Origin",
} as const;

interface ProblemInput {
  readonly code: string;
  readonly detail: string;
  readonly headers?: HeadersInit;
  readonly instance: string;
  readonly requestId: string;
  readonly resolution: string;
  readonly status: AgentProblemStatus;
  readonly title: string;
  readonly type: string;
}

/** Returns a no-store JSON response with the public CORS contract. */
export function agentJsonResponse(
  body: unknown,
  status = 200,
  headers?: HeadersInit
) {
  return new Response(JSON.stringify(body), {
    headers: { ...PUBLIC_API_HEADERS, ...headers },
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

/** Maps typed agent domain failures to public Problem Details. */
export function agentFailureResponse(
  error: NakafaAgentInputError | NakafaAgentDataReadError,
  instance: string,
  requestId: string
) {
  if (error._tag === "NakafaAgentInputError") {
    return problemResponse({
      code: "UNPROCESSABLE_REQUEST",
      detail: error.cause ?? error.message,
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
export function internalFailureResponse(instance: string, requestId: string) {
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

/** Returns the shared successful CORS preflight response. */
export function agentOptionsResponse() {
  return new Response(null, {
    headers: PUBLIC_API_HEADERS,
    status: 204,
  });
}
