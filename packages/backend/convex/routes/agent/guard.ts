import {
  NAKAFA_API_EDGE_CONTRACT,
  projectPublicApiPath,
} from "@repo/backend/agent/edge";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { hasRequestBody } from "@repo/backend/convex/routes/agent/input";
import { problemResponse } from "@repo/backend/convex/routes/agent/response";
import { hasValidEdgeSecret } from "@repo/backend/convex/routes/agent/security";
import {
  HttpMediaTypeSchema,
  negotiateMediaType,
} from "@repo/utilities/http/accept";
import { Effect, Option } from "effect";
import type { MiddlewareHandler } from "hono";

const JSON_MEDIA_TYPE = HttpMediaTypeSchema.make(
  "application/json; charset=utf-8"
);

interface AgentVariables {
  requestId: string;
}

/** Guards the Convex origin before any public API route dispatches. */
export const guardAgentApi: MiddlewareHandler<{
  Bindings: ActionCtx;
  Variables: AgentVariables;
}> = async (context, next) => {
  const request = context.req.raw;
  const instance = projectPublicApiPath(new URL(request.url).pathname);
  const requestId = context.get("requestId");
  const secret = await Effect.runPromise(
    hasValidEdgeSecret(request, NAKAFA_API_EDGE_CONTRACT).pipe(
      Effect.match({
        onFailure: () => null,
        onSuccess: (valid) => valid,
      })
    )
  );
  if (secret === null) {
    return problemResponse({
      code: "SERVICE_UNAVAILABLE",
      detail: "The public API edge authentication boundary is unavailable.",
      instance,
      requestId,
      resolution: "Retry through https://api.nakafa.com later.",
      status: 503,
      title: "Service unavailable",
      type: "service-unavailable",
    });
  }
  if (!secret) {
    return problemResponse({
      code: "ORIGIN_ACCESS_DENIED",
      detail: "Direct access to this Convex origin is not allowed.",
      instance,
      requestId,
      resolution: "Send the request through https://api.nakafa.com.",
      status: 403,
      title: "Forbidden",
      type: "origin-access-denied",
    });
  }
  if (request.method !== "GET" && request.method !== "OPTIONS") {
    return problemResponse({
      code: "METHOD_NOT_ALLOWED",
      detail: "The Nakafa public API supports GET and OPTIONS only.",
      headers: { Allow: "GET, OPTIONS" },
      instance,
      requestId,
      resolution: "Retry this endpoint with GET or OPTIONS.",
      status: 405,
      title: "Method not allowed",
      type: "method-not-allowed",
    });
  }
  if (
    Option.isNone(
      negotiateMediaType(Option.fromNullishOr(request.headers.get("accept")), [
        JSON_MEDIA_TYPE,
      ])
    )
  ) {
    return problemResponse({
      code: "NOT_ACCEPTABLE",
      detail: "The public API returns application/json responses.",
      instance,
      requestId,
      resolution: "Send Accept: application/json or Accept: */*.",
      status: 406,
      title: "Not acceptable",
      type: "not-acceptable",
    });
  }
  if (hasRequestBody(request)) {
    return problemResponse({
      code: "UNSUPPORTED_MEDIA_TYPE",
      detail: "The read-only public API does not accept request bodies.",
      instance,
      requestId,
      resolution: "Remove the request body and its Content-Type header.",
      status: 415,
      title: "Unsupported media type",
      type: "unsupported-media-type",
    });
  }
  return next();
};
