import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import spec from "@repo/backend/confect/island/queries.spec";
import { findIsland } from "@repo/backend/confect/island/store";
import { toOwnIsland } from "@repo/backend/confect/island/view";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer, Option } from "effect";

/** The signed-in learner's island, none before their first grant or visit. */
const own = FunctionImpl.make(
  databaseSchema,
  spec,
  "own",
  Effect.fn("island.queries.own")(function* () {
    const user = yield* getOptionalAppUserForRead();
    if (!user) {
      return null;
    }
    const island = yield* findIsland(user.appUser._id);
    return Option.match(island, { onNone: () => null, onSome: toOwnIsland });
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(own),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
