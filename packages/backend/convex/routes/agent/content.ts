import { getNakafaContent } from "@repo/backend/agent/content";
import { decodeAgentInput } from "@repo/backend/agent/decode";
import { projectPublicApiPath } from "@repo/backend/agent/edge";
import { readContentInput } from "@repo/backend/convex/routes/agent/input";
import {
  agentJsonResponse,
  agentOptionsResponse,
  problemResponse,
} from "@repo/backend/convex/routes/agent/response";
import {
  type AgentApp,
  runMeteredRequest,
} from "@repo/backend/convex/routes/agent/runtime";
import { NAKAFA_PUBLIC_API_PATH } from "@repo/contents/_lib/agent/constants";
import { NakafaAgentContentRefInputSchema } from "@repo/contents/_lib/agent/schema/read";
import { Effect, Option } from "effect";

/** Registers the canonical content read and its matching preflight. */
export function registerAgentContentRoute(api: AgentApp) {
  api.get("/content", (context) =>
    runMeteredRequest(
      context.env,
      context.req.raw,
      context.get("requestId"),
      readContentInput(new URL(context.req.url)).pipe(
        Effect.flatMap((ref) =>
          decodeAgentInput(
            NakafaAgentContentRefInputSchema,
            ref,
            "Invalid Nakafa content reference."
          )
        ),
        Effect.flatMap((ref) => getNakafaContent(context.env, ref)),
        Effect.map(
          Option.match({
            onNone: () =>
              contentNotFoundResponse(
                context.req.raw,
                context.get("requestId")
              ),
            onSome: agentJsonResponse,
          })
        )
      )
    )
  );
  api.options("/content", () => agentOptionsResponse());
}

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
