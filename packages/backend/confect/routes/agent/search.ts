import { searchNakafaContent } from "@repo/backend/agent/search";
import { readSearchInput } from "@repo/backend/confect/routes/agent/input";
import {
  agentJsonResponse,
  agentOptionsResponse,
} from "@repo/backend/confect/routes/agent/response";
import { runMeteredRequest } from "@repo/backend/confect/routes/agent/runtime";
import { RequestIdentity } from "@repo/backend/confect/routes/middleware/identity";
import { Effect } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
/** Serves the bounded public search contract through native Confect services. */
export const searchRoutes = [
  HttpRouter.route(
    "GET",
    "/search",
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.toWeb(
        yield* HttpServerRequest.HttpServerRequest
      );
      const requestId = yield* RequestIdentity;
      return HttpServerResponse.fromWeb(
        yield* runMeteredRequest(
          request,
          requestId,
          readSearchInput(new URL(request.url)).pipe(
            Effect.flatMap((input) => searchNakafaContent(input)),
            Effect.map(agentJsonResponse)
          )
        )
      );
    })
  ),
  HttpRouter.route(
    "OPTIONS",
    "/search",
    HttpServerResponse.fromWeb(agentOptionsResponse())
  ),
];
