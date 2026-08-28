import { searchNakafaContent } from "@repo/backend/agent/search";
import { readSearchInput } from "@repo/backend/convex/routes/agent/input";
import {
  agentJsonResponse,
  agentOptionsResponse,
} from "@repo/backend/convex/routes/agent/response";
import {
  type AgentApp,
  runMeteredRequest,
} from "@repo/backend/convex/routes/agent/runtime";
import { Effect } from "effect";

/** Registers the canonical search read and its matching preflight. */
export function registerAgentSearchRoute(api: AgentApp) {
  api.get("/v1/search", (context) =>
    runMeteredRequest(
      context.env,
      context.req.raw,
      context.get("requestId"),
      readSearchInput(new URL(context.req.url)).pipe(
        Effect.flatMap((input) => searchNakafaContent(context.env, input)),
        Effect.map(agentJsonResponse)
      )
    )
  );
  api.options("/v1/search", () => agentOptionsResponse());
}
