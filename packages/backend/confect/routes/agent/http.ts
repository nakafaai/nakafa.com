import { HttpRouter as ConfectHttpRouter } from "@confect/server";
import { agentApiRoutes } from "@repo/backend/confect/routes/agent/api";
import { agentMcpRoutes } from "@repo/backend/confect/routes/agent/mcp/route";
import { requestContext } from "@repo/backend/confect/routes/middleware/context";
import { Layer } from "effect";

export default ConfectHttpRouter.make(
  Layer.mergeAll(agentApiRoutes, agentMcpRoutes).pipe(
    Layer.provide(requestContext.layer)
  )
);
