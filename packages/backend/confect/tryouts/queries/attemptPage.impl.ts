import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import {
  readSectionAttemptPage,
  readSetAttemptPage,
} from "@repo/backend/confect/tryouts/attemptPage/impl";
import spec from "@repo/backend/confect/tryouts/queries/attemptPage.spec";
import { Effect, Layer } from "effect";

const getSet = FunctionImpl.make(
  databaseSchema,
  spec,
  "getSet",
  Effect.fn("tryouts.queries.attemptPage.getSet")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* readSetAttemptPage(ctx, args.request);
  })
);
const getSection = FunctionImpl.make(
  databaseSchema,
  spec,
  "getSection",
  Effect.fn("tryouts.queries.attemptPage.getSection")(function* (args) {
    const ctx = yield* QueryCtxService;
    return yield* readSectionAttemptPage(ctx, args.request);
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getSet),
  Layer.provide(getSection),
  GroupImpl.finalize
);
