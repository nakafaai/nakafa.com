import { getNakafaContent } from "@repo/backend/agent/content";
import { decodeAgentInput } from "@repo/backend/agent/decode";
import { projectPublicApiPath } from "@repo/backend/agent/edge";
import { readContentInput } from "@repo/backend/confect/routes/agent/input";
import {
  agentJsonResponse,
  agentOptionsResponse,
  problemResponse,
} from "@repo/backend/confect/routes/agent/response";
import { runMeteredRequest } from "@repo/backend/confect/routes/agent/runtime";
import { RequestIdentity } from "@repo/backend/confect/routes/middleware/identity";
import { NAKAFA_PUBLIC_API_PATH } from "@repo/contents/agent/constants";
import { NakafaAgentContentRefInputSchema } from "@repo/contents/agent/schema/read";
import { Effect, Option } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
/** Serves the bounded public content contract through native Confect services. */
export const contentRoutes = [
  HttpRouter.route(
    "GET",
    "/content",
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.toWeb(
        yield* HttpServerRequest.HttpServerRequest
      );
      const requestId = yield* RequestIdentity;
      return HttpServerResponse.fromWeb(
        yield* runMeteredRequest(
          request,
          requestId,
          readContentInput(new URL(request.url)).pipe(
            Effect.flatMap((ref) =>
              decodeAgentInput(
                NakafaAgentContentRefInputSchema,
                ref,
                "Invalid Nakafa content reference."
              )
            ),
            Effect.flatMap((ref) => getNakafaContent(ref)),
            Effect.map(
              Option.match({
                onNone: () => contentNotFoundResponse(request, requestId),
                onSome: agentJsonResponse,
              })
            )
          )
        )
      );
    })
  ),
  HttpRouter.route(
    "OPTIONS",
    "/content",
    HttpServerResponse.fromWeb(agentOptionsResponse())
  ),
];

/** Returns a stable missing-content problem. */
function contentNotFoundResponse(request: Request, requestId: string) {
  return problemResponse({
    code: "CONTENT_NOT_FOUND",
    detail: "No public Nakafa content matched the supplied reference.",
    instance: projectPublicApiPath(new URL(request.url).pathname),
    requestId,
    resolution: `Use a content_id from ${NAKAFA_PUBLIC_API_PATH}/search with markdown_url, or a canonical readable Nakafa URL.`,
    status: 404,
    title: "Content not found",
    type: "content-not-found",
  });
}
