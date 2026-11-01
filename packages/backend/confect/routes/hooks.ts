import { HttpRouter as ConfectHttpRouter } from "@confect/server";
import { requestContext } from "@repo/backend/confect/routes/middleware/context";
import { polarRoutes } from "@repo/backend/confect/routes/polar";
import { registerResendRoutes } from "@repo/backend/confect/routes/resend";
import { xenditRoutes } from "@repo/backend/confect/routes/xendit";
import { Layer } from "effect";

const http = ConfectHttpRouter.make(
  Layer.mergeAll(polarRoutes, xenditRoutes).pipe(
    Layer.provide(requestContext.layer)
  )
);

registerResendRoutes(http);

export default http;
