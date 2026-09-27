import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/auth/queries.spec";
import { getOptionalAppUserForRead } from "@repo/backend/confect/auth/session";
import session from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer } from "effect";

const getCurrentUser = FunctionImpl.make(
  databaseSchema,
  spec,
  "getCurrentUser",
  getOptionalAppUserForRead
);
const getUserById = FunctionImpl.make(
  databaseSchema,
  spec,
  "getUserById",
  Effect.fn("auth.queries.getUserById")(function* (args) {
    const database = yield* DatabaseReader;
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
  Layer.provide(session),
  GroupImpl.finalize
);
