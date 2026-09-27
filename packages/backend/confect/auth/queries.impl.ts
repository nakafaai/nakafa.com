import { DatabaseReader, FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import { getCurrentUser as currentIdentity } from "@repo/backend/confect/auth/identity";
import spec from "@repo/backend/confect/auth/queries.spec";
import { Effect, Layer } from "effect";

const getCurrentUser = FunctionImpl.make(
  databaseSchema,
  spec,
  "getCurrentUser",
  currentIdentity
);
const getUserById = FunctionImpl.make(
  databaseSchema,
  spec,
  "getUserById",
  Effect.fn("auth.queries.getUserById")(function* (args) {
    const ctx = yield* QueryCtxService;
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const user = yield* database
      .table("users")
      .get(args.userId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (!user) {
      return null;
    }
    return {
      ...(user.image === null || user.image === undefined
        ? {}
        : {
            image: user.image,
          }),
      name: user.name,
    };
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(getCurrentUser),
  Layer.provide(getUserById),
  GroupImpl.finalize
);
