import {
  NAKAFA_API_EDGE_CONTRACT,
  projectPublicApiPath,
} from "@repo/backend/agent/edge";
import { hasRequestBody } from "@repo/backend/confect/routes/agent/input";
import { problemResponse } from "@repo/backend/confect/routes/agent/response";
import { hasValidEdgeSecret } from "@repo/backend/confect/routes/agent/security";
import { RequestIdentity } from "@repo/backend/confect/routes/middleware/identity";
import {
  HttpMediaTypeSchema,
  negotiateMediaType,
} from "@repo/utilities/http/accept";
import { Effect, Option } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

const JSON_MEDIA_TYPE = HttpMediaTypeSchema.make(
  "application/json; charset=utf-8"
);
/** Guards the Convex origin before any public API route dispatches. */
export const guardAgentApi = HttpRouter.middleware((handler) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.toWeb(
      yield* HttpServerRequest.HttpServerRequest
    );
    const requestId = yield* RequestIdentity;
    const instance = projectPublicApiPath(new URL(request.url).pathname);
    const secret = yield* hasValidEdgeSecret(
      request,
      NAKAFA_API_EDGE_CONTRACT
    ).pipe(
      Effect.match({
        onFailure: () => null,
        onSuccess: (valid) => valid,
      })
    );
    if (secret === null) {
      return HttpServerResponse.fromWeb(
        problemResponse({
          code: "SERVICE_UNAVAILABLE",
          detail: "The public API edge authentication boundary is unavailable.",
          instance,
          requestId,
          resolution: "Retry through https://api.nakafa.com later.",
          status: 503,
          title: "Service unavailable",
          type: "service-unavailable",
        })
      );
    }
    if (!secret) {
      return HttpServerResponse.fromWeb(
        problemResponse({
          code: "ORIGIN_ACCESS_DENIED",
          detail: "Direct access to this Convex origin is not allowed.",
          instance,
          requestId,
          resolution: "Send the request through https://api.nakafa.com.",
          status: 403,
          title: "Forbidden",
          type: "origin-access-denied",
        })
      );
    }
    if (request.method !== "GET" && request.method !== "OPTIONS") {
      return HttpServerResponse.fromWeb(
        problemResponse(
          {
            code: "METHOD_NOT_ALLOWED",
            detail: "The Nakafa public API supports GET and OPTIONS only.",
            instance,
            requestId,
            resolution: "Retry this endpoint with GET or OPTIONS.",
            status: 405,
            title: "Method not allowed",
            type: "method-not-allowed",
          },
          {
            Allow: "GET, OPTIONS",
          }
        )
      );
    }
    if (
      Option.isNone(
        negotiateMediaType(
          Option.fromNullishOr(request.headers.get("accept")),
          [JSON_MEDIA_TYPE]
        )
      )
    ) {
      return HttpServerResponse.fromWeb(
        problemResponse({
          code: "NOT_ACCEPTABLE",
          detail: "The public API returns application/json responses.",
          instance,
          requestId,
          resolution: "Send Accept: application/json or Accept: */*.",
          status: 406,
          title: "Not acceptable",
          type: "not-acceptable",
        })
      );
    }
    if (hasRequestBody(request)) {
      return HttpServerResponse.fromWeb(
        problemResponse({
          code: "UNSUPPORTED_MEDIA_TYPE",
          detail: "The read-only public API does not accept request bodies.",
          instance,
          requestId,
          resolution: "Remove the request body and its Content-Type header.",
          status: 415,
          title: "Unsupported media type",
          type: "unsupported-media-type",
        })
      );
    }
    return yield* handler;
  })
);
