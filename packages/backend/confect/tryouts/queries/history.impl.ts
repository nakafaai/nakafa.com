import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import { readHistoryPage } from "@repo/backend/confect/tryouts/queries/history";
import spec from "@repo/backend/confect/tryouts/queries/history.spec";
import { decodeTryoutSetIdentity } from "@repo/backend/confect/tryouts/route";
import { Effect, Layer } from "effect";

const bySet = FunctionImpl.make(
  databaseSchema,
  spec,
  "bySet",
  Effect.fn("tryouts.queries.history.bySet")(function* (args) {
    const ctx = yield* QueryCtxService;
    const { paginationOpts, ...identity } = args;
    return yield* decodeTryoutSetIdentity(identity).pipe(
      Effect.flatMap((decodedIdentity) =>
        readHistoryPage(ctx, decodedIdentity, paginationOpts)
      )
    );
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(bySet),
  GroupImpl.finalize
);
