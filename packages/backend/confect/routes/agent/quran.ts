import { getNakafaQuranReference } from "@repo/backend/agent/quran";
import { readQuranInput } from "@repo/backend/confect/routes/agent/input";
import {
  agentJsonResponse,
  agentOptionsResponse,
} from "@repo/backend/confect/routes/agent/response";
import { runMeteredRequest } from "@repo/backend/confect/routes/agent/runtime";
import { RequestIdentity } from "@repo/backend/confect/routes/middleware/identity";
import { Effect, Schema } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
/** Serves the bounded public quran contract through native Confect services. */
export const quranRoutes = [
  HttpRouter.route(
    "GET",
    "/quran/:surah",
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.toWeb(
        yield* HttpServerRequest.HttpServerRequest
      );
      const requestId = yield* RequestIdentity;
      const params = yield* HttpRouter.schemaPathParams(
        Schema.Struct({
          surah: Schema.String,
        })
      );
      return HttpServerResponse.fromWeb(
        yield* runMeteredRequest(
          request,
          requestId,
          readQuranInput(new URL(request.url), params.surah).pipe(
            Effect.flatMap((input) => getNakafaQuranReference(input)),
            Effect.map(agentJsonResponse)
          )
        )
      );
    })
  ),
  HttpRouter.route(
    "OPTIONS",
    "/quran/:surah",
    HttpServerResponse.fromWeb(agentOptionsResponse())
  ),
];
