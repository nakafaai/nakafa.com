import { projectPublicApiPath } from "@repo/backend/agent/edge";
import {
  getNakafaQuranReference,
  getNakafaQuranReferenceV2,
} from "@repo/backend/agent/quran";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { readQuranInput } from "@repo/backend/convex/routes/agent/input";
import {
  agentJsonResponse,
  agentOptionsResponse,
  problemResponse,
} from "@repo/backend/convex/routes/agent/response";
import {
  type AgentApp,
  runMeteredRequest,
} from "@repo/backend/convex/routes/agent/runtime";
import type {
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/_lib/agent/errors";
import { Effect, Option } from "effect";

type ReadQuranReference = (
  ctx: ActionCtx,
  input: unknown
) => Effect.Effect<
  Option.Option<unknown>,
  NakafaAgentDataReadError | NakafaAgentInputError
>;

/** Registers immutable V1 and explicit V2 Quran read routes. */
export function registerAgentQuranRoutes(api: AgentApp) {
  registerQuranRoute(api, "/v1/quran/:surah", (ctx, input) =>
    getNakafaQuranReference(ctx, input)
  );
  registerQuranRoute(api, "/v2/quran/:surah", (ctx, input) =>
    getNakafaQuranReferenceV2(ctx, input)
  );
}

/** Registers one versioned Quran GET and its matching preflight. */
function registerQuranRoute(
  api: AgentApp,
  path: "/v1/quran/:surah" | "/v2/quran/:surah",
  readReference: ReadQuranReference
) {
  api.get(path, (context) =>
    runMeteredRequest(
      context.env,
      context.req.raw,
      context.get("requestId"),
      readQuranInput(new URL(context.req.url), context.req.param("surah")).pipe(
        Effect.flatMap((input) => readReference(context.env, input)),
        Effect.map(
          Option.match({
            onNone: () =>
              quranNotFoundResponse(context.req.raw, context.get("requestId")),
            onSome: agentJsonResponse,
          })
        )
      )
    )
  );
  api.options(path, () => agentOptionsResponse());
}

/** Returns a stable missing-Quran-reference problem. */
function quranNotFoundResponse(request: Request, requestId: string) {
  return problemResponse({
    code: "QURAN_REFERENCE_NOT_FOUND",
    detail: "The requested Quran reference was not found.",
    instance: projectPublicApiPath(new URL(request.url).pathname),
    requestId,
    resolution: "Pass a surah number from 1 through 114.",
    status: 404,
    title: "Quran reference not found",
    type: "quran-reference-not-found",
  });
}
