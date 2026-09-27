import { MiddlewareImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import {
  ActionCtx,
  DatabaseReader,
  MutationCtx,
  QueryCtx,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { authReader } from "@repo/backend/confect/auth/reader";
import { Session } from "@repo/backend/confect/auth/session";
import { AuthReadError } from "@repo/backend/confect/auth/spec";
import SessionMiddleware from "@repo/backend/confect/middleware/session.spec";
import { Effect } from "effect";

const authReadFailure = () =>
  new AuthReadError({
    code: "AUTH_READ_FAILED",
    message: "Unable to read authentication state.",
  });

/** Better Auth's SDK owns session expiry and component identity validation. */
const readAuthUser = Effect.fn("auth.readSession")(function* (
  ctx: Parameters<typeof authReader.safeGetAuthUser>[0]
) {
  return yield* Effect.tryPromise({
    try: () => authReader.safeGetAuthUser(ctx),
    catch: authReadFailure,
  });
});
const readAppUser = Effect.fn("auth.readAppUser")(function* (authId: string) {
  const reader = yield* DatabaseReader;
  return yield* reader
    .table("users")
    .get("by_authId", authId)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.mapError(authReadFailure),
      Effect.catchDefect(() => Effect.fail(authReadFailure()))
    );
});
export default MiddlewareImpl.makeByFunctionType(schema, SessionMiddleware, {
  query: Effect.fn("auth.querySession")(function* (effect) {
    const authUser = yield* readAuthUser(yield* QueryCtx);
    const appUser = authUser ? yield* readAppUser(authUser._id) : null;
    return yield* effect.pipe(
      Effect.provideService(Session, {
        authUser,
        appUser,
      })
    );
  }),
  mutation: Effect.fn("auth.mutationSession")(function* (effect) {
    const authUser = yield* readAuthUser(yield* MutationCtx);
    const appUser = authUser ? yield* readAppUser(authUser._id) : null;
    return yield* effect.pipe(
      Effect.provideService(Session, {
        authUser,
        appUser,
      })
    );
  }),
  action: Effect.fn("auth.actionSession")(function* (effect) {
    const authUser = yield* readAuthUser(yield* ActionCtx);
    const runQuery = yield* QueryRunner;
    const appUser = authUser
      ? yield* runQuery(refs.internal.users.queries.getUserByAuthId, {
          authId: authUser._id,
        }).pipe(
          Effect.mapError(authReadFailure),
          Effect.catchDefect(() => Effect.fail(authReadFailure()))
        )
      : null;
    return yield* effect.pipe(
      Effect.provideService(Session, {
        authUser,
        appUser,
      })
    );
  }),
});
