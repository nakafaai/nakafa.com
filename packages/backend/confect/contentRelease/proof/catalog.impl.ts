import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import { pageProgram } from "@repo/backend/confect/contentRelease/proof/catalog";
import spec from "@repo/backend/confect/contentRelease/proof/catalog.spec";
import { Effect, Layer } from "effect";

const page = FunctionImpl.make(
  databaseSchema,
  spec,
  "page",
  Effect.fn("contentRelease.proof.catalog.page")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* pageProgram(ctx, args.releaseId, args.cursor);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(page),
  GroupImpl.finalize
);
