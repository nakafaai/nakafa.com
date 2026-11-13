import { MiddlewareImpl } from "@confect/server";
import authInternal from "@repo/backend/confect/_generated/refs/auth.server";
import schema from "@repo/backend/confect/_generated/schema";
import {
  MutationCtx,
  QueryCtx,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { readCaller } from "@repo/backend/confect/auth/caller";
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
 * Resolves the caller once for each function: the user that the caller's live
 * Convex Auth session or agent grant names, and that user's row. Every function
 * type reads the session row, so a signed-out session or a revoked grant stops
 * at once, and the session row changes only when it starts or ends, so a token
 * refresh never reruns a query.
 * https://docs.convex.dev/auth/convex-auth/best-practices
 */
export default MiddlewareImpl.makeByFunctionType(schema, SessionMiddleware, {
  query: Effect.fn("auth.querySession")(function* (effect) {
    const caller = yield* readCaller(yield* QueryCtx);
    return yield* effect.pipe(Effect.provideService(Session, caller));
  }),
  mutation: Effect.fn("auth.mutationSession")(function* (effect) {
    const caller = yield* readCaller(yield* MutationCtx);
    return yield* effect.pipe(Effect.provideService(Session, caller));
  }),
  action: Effect.fn("auth.actionSession")(function* (effect) {
    const { runQuery } = yield* QueryRunner;
    const caller = yield* runQuery(authInternal.caller.read, {}).pipe(
      Effect.mapError(authReadFailure),
      Effect.catchDefect(() => Effect.fail(authReadFailure()))
    );
    return yield* effect.pipe(
      Effect.provideService(Session, {
        userId: caller.userId ?? undefined,
        appUser: caller.appUser,
      })
    );
  }),
});
