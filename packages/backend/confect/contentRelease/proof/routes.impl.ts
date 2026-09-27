import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import { routeProgram } from "@repo/backend/confect/contentRelease/proof/routes";
import spec from "@repo/backend/confect/contentRelease/proof/routes.spec";
import { Effect, Layer } from "effect";

const routes = FunctionImpl.make(
  databaseSchema,
  spec,
  "routes",
  Effect.fn("contentRelease.proof.routes.routes")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* routeProgram(ctx, args.releaseId, args.cursor);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(routes),
  GroupImpl.finalize
);
