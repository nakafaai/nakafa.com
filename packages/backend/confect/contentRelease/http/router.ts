import { HttpRouter as ConfectHttpRouter } from "@confect/server";
import { batchRuntimeRoutes } from "@repo/backend/confect/contentRelease/http/runtime/batch";
import { publicRuntimeRoutes } from "@repo/backend/confect/contentRelease/http/runtime/public";
import { publicationRoutes } from "@repo/backend/confect/contentRelease/ingress/route";
import { requestContext } from "@repo/backend/confect/routes/middleware/context";
import { Layer } from "effect";

export default ConfectHttpRouter.make(
  Layer.mergeAll(
    publicationRoutes,
    batchRuntimeRoutes,
    publicRuntimeRoutes
  ).pipe(Layer.provide(requestContext.layer))
);
