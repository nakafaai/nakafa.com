import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import spec from "@repo/backend/confect/tryouts/queries/ranks.spec";
import { readSetBoard } from "@repo/backend/confect/tryouts/rank/read";
import {
  decodeTryoutSetIdentity,
  tryoutSetIdentityOf,
} from "@repo/backend/confect/tryouts/route";
import { Effect, Layer, Option } from "effect";

/** One set's board, for anyone; a signed-in viewer also reads their own place on it. */
const bySet = FunctionImpl.make(
  databaseSchema,
  spec,
  "bySet",
  Effect.fn("tryouts.queries.ranks.bySet")(function* ({ score, ...keys }) {
    const identity = yield* decodeTryoutSetIdentity(keys);
    const user = yield* getOptionalAppUserForRead();
    return yield* readSetBoard(
      tryoutSetIdentityOf(identity),
      Option.map(Option.fromNullishOr(user), (found) => found.appUser._id),
      Option.fromNullishOr(score)
    );
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(bySet),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
