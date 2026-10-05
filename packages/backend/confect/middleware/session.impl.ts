import { MiddlewareImpl } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import {
  ActionCtx,
  Auth,
  DatabaseReader,
  MutationCtx,
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

/**
 * Better Auth confirms the session is still live before a write. Its SDK owns
 * session expiry and component identity validation.
 */
const readSessionAuthId = Effect.fn("auth.readSession")(function* (
  ctx: Parameters<typeof authReader.safeGetAuthUser>[0]
) {
  const authUser = yield* Effect.tryPromise({
    try: () => authReader.safeGetAuthUser(ctx),
    catch: authReadFailure,
  });
  return authUser?._id;
});
/**
 * A read trusts the token Convex verified against Better Auth's keys. The
 * token's short expiry bounds how long a revoked session can still read, and
 * skipping the two component lookups keeps every signed-in query fast.
 * @see https://docs.convex.dev/auth/functions-auth
 */
const readTokenAuthId = Effect.fn("auth.readToken")(function* () {
  return yield* (yield* Auth).getUserIdentity.pipe(
    Effect.map((identity) => identity.subject),
    Effect.catchTag("NoUserIdentityFoundError", () => Effect.undefined)
  );
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
    const authId = yield* readTokenAuthId();
    const appUser = authId ? yield* readAppUser(authId) : null;
    return yield* effect.pipe(
      Effect.provideService(Session, {
        authId,
        appUser,
      })
    );
  }),
  mutation: Effect.fn("auth.mutationSession")(function* (effect) {
    const authId = yield* readSessionAuthId(yield* MutationCtx);
    const appUser = authId ? yield* readAppUser(authId) : null;
    return yield* effect.pipe(
      Effect.provideService(Session, {
        authId,
        appUser,
      })
    );
  }),
  action: Effect.fn("auth.actionSession")(function* (effect) {
    const authId = yield* readSessionAuthId(yield* ActionCtx);
    const { runQuery } = yield* QueryRunner;
    const appUser = authId
      ? yield* runQuery(refs.internal.users.queries.getUserByAuthId, {
          authId,
        }).pipe(
          Effect.mapError(authReadFailure),
          Effect.catchDefect(() => Effect.fail(authReadFailure()))
        )
      : null;
    return yield* effect.pipe(
      Effect.provideService(Session, {
        authId,
        appUser,
      })
    );
  }),
});
