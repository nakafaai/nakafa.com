import { MiddlewareImpl } from "@confect/server";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import {
  ActionCtx,
  Auth,
  DatabaseReader,
  MutationCtx,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { Session } from "@repo/backend/confect/auth/session";
import { AuthReadError } from "@repo/backend/confect/auth/spec";
import SessionMiddleware from "@repo/backend/confect/middleware/session.spec";
import type { GenericActionCtx, GenericDataModel } from "convex/server";
import { Clock, Effect, Option, Schema } from "effect";

const authReadFailure = () =>
  new AuthReadError({
    code: "AUTH_READ_FAILED",
    message: "Unable to read authentication state.",
  });

/** The session and the user that a verified token names. */
const TokenSession = Schema.Struct({
  sessionId: Schema.String,
  subject: Schema.String,
});
const decodeTokenSession = Schema.decodeUnknownEffect(TokenSession);

/**
 * A write confirms with Better Auth that its session is still live. The token
 * names the session and the user, and one read in the component says whether
 * that session exists, has not expired and belongs to that user, and whether
 * the user still exists. The read is the component's own small query and not
 * Better Auth's adapter, which answers the same question with two lookups
 * through a module fifty times the size. A verified token that does not name
 * its session is a failed read, never an absent session: Better Auth puts the
 * session in every token it issues.
 */
const readSessionAuthId = Effect.fn("auth.readSession")(function* (
  ctx: Pick<GenericActionCtx<GenericDataModel>, "runQuery">
) {
  const identity = yield* (yield* Auth).getUserIdentity.pipe(
    Effect.asSome,
    Effect.catchTag("NoUserIdentityFoundError", () => Effect.succeedNone)
  );
  if (Option.isNone(identity)) {
    return;
  }
  const { sessionId, subject } = yield* decodeTokenSession(identity.value).pipe(
    Effect.mapError(authReadFailure)
  );
  const now = yield* Clock.currentTimeMillis;
  const live = yield* Effect.tryPromise({
    try: () =>
      ctx.runQuery(components.betterAuth.session.live, {
        now,
        sessionId,
        userId: subject,
      }),
    catch: authReadFailure,
  });
  return live ? subject : undefined;
});
/**
 * A read trusts the token Convex verified against Better Auth's keys. The
 * token's short expiry bounds how long a revoked session can still read, and
 * skipping the component read keeps every signed-in query fast.
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
