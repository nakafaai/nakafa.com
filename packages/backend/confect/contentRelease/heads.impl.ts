import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import { headPageProgram } from "@repo/backend/confect/contentRelease/heads";
import spec from "@repo/backend/confect/contentRelease/heads.spec";
import { Effect, Layer } from "effect";

/** Decodes one bounded active-head request into the exact shared contract. */
const page = FunctionImpl.make(
  databaseSchema,
  spec,
  "page",
  Effect.fn("contentRelease.heads.page")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* headPageProgram(ctx, args);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(page),
  GroupImpl.finalize
);
