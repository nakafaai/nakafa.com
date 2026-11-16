import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import {
  readHistoryPage,
  readRecentAttempts,
} from "@repo/backend/confect/tryouts/queries/history";
import spec from "@repo/backend/confect/tryouts/queries/history.spec";
import { decodeTryoutSetIdentity } from "@repo/backend/confect/tryouts/route";
import { Effect, Layer } from "effect";

const bySet = FunctionImpl.make(
  databaseSchema,
  spec,
  "bySet",
  Effect.fn("tryouts.queries.history.bySet")(function* (args) {
    const { paginationOpts, ...identity } = args;
    return yield* decodeTryoutSetIdentity(identity).pipe(
      Effect.flatMap((decodedIdentity) =>
        readHistoryPage(decodedIdentity, paginationOpts)
      )
    );
  })
);
const recent = FunctionImpl.make(
  databaseSchema,
  spec,
  "recent",
  Effect.fn("tryouts.queries.history.recent")(function* () {
    return yield* readRecentAttempts();
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(bySet),
  Layer.provide(recent),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
