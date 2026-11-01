import { HttpRouter as ConfectHttpRouter } from "@confect/server";
import { schoolMcpRoutes } from "@repo/backend/confect/integrations/mcp";
import { schoolApiRoutes } from "@repo/backend/confect/integrations/routes";
import { requestContext } from "@repo/backend/confect/routes/middleware/context";
import { Layer } from "effect";

export default ConfectHttpRouter.make(
  Layer.mergeAll(schoolApiRoutes, schoolMcpRoutes).pipe(
    Layer.provide(requestContext.layer)
  )
);
