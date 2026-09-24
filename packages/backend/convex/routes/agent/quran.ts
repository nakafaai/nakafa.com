import { getNakafaQuranReference } from "@repo/backend/agent/quran";
import { readQuranInput } from "@repo/backend/convex/routes/agent/input";
import {
  agentJsonResponse,
  agentOptionsResponse,
} from "@repo/backend/convex/routes/agent/response";
import {
  type AgentApp,
  runMeteredRequest,
} from "@repo/backend/convex/routes/agent/runtime";
import { Effect } from "effect";

/** Registers the bounded signed Quran read and its matching preflight. */
export function registerAgentQuranRoutes(api: AgentApp) {
  api.get("/quran/:surah", (context) =>
    runMeteredRequest(
      context.env,
      context.req.raw,
      context.get("requestId"),
      readQuranInput(new URL(context.req.url), context.req.param("surah")).pipe(
        Effect.flatMap((input) => getNakafaQuranReference(context.env, input)),
        Effect.map(agentJsonResponse)
      )
    )
  );
  api.options("/quran/:surah", () => agentOptionsResponse());
}
