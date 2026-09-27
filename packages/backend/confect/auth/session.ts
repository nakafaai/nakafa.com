import { DatabaseReader, QueryRunner } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import { authReader } from "@repo/backend/confect/auth/reader";
import {
  AccountUnavailable,
  AuthReadError,
  accountUnavailableCode,
  accountUnavailableMessage,
  SessionRequired,
} from "@repo/backend/confect/auth/spec";
import type {
  ActionCtx,
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

function authReadFailure() {
  return new AuthReadError({
    code: "AUTH_READ_FAILED",
    message: "Unable to read authentication state.",
  });
}

/** Better Auth owns session expiry and component identity validation. */
const readSession = Effect.fn("auth.readSession")(function* (
  ctx: QueryCtx | MutationCtx | ActionCtx
) {
  return yield* Effect.tryPromise({
    try: () => authReader.safeGetAuthUser(ctx),
    catch: authReadFailure,
  });
});

const requireSession = Effect.fn("auth.requireSession")(function* (
  ctx: QueryCtx | MutationCtx | ActionCtx
) {
  const authUser = yield* readSession(ctx);
  if (!authUser) {
    return yield* new SessionRequired({
      code: "UNAUTHENTICATED",
      message: "Unauthenticated",
    });
  }
  return authUser;
});

/** Decode the app identity while preserving unique auth-id ownership. */
const readAppUser = Effect.fn("auth.readAppUser")(function* (
  ctx: QueryCtx | MutationCtx,
  authId: string
) {
  const database = DatabaseReader.make(databaseSchema, ctx.db);
  return yield* database
    .table("users")
    .get("by_authId", authId)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.mapError(authReadFailure),
      Effect.catchDefect(() => authReadFailure())
    );
});

const loadOptionalAuthContext = Effect.fn("auth.loadOptionalContext")(
  function* (ctx: QueryCtx | MutationCtx) {
    const authUser = yield* readSession(ctx);
    if (!authUser) {
      return null;
    }
    const appUser = yield* readAppUser(ctx, authUser._id);
    return appUser ? { appUser, authUser } : null;
  }
);

/** Prepared users remain readable for account recovery. */
export const getOptionalAppUserForRead = Effect.fn("auth.optionalRead")(
  function* (ctx: QueryCtx) {
    const auth = yield* loadOptionalAuthContext(ctx);
    return auth && auth.appUser.deletedAt === undefined ? auth : null;
  }
);

/** Prepared sessions cannot create new writes as anonymous users. */
export const getOptionalActiveAppUser = Effect.fn("auth.optionalWrite")(
  function* (ctx: MutationCtx) {
    const auth = yield* loadOptionalAuthContext(ctx);
    if (auth && isAccountDeletionPending(auth.appUser)) {
      return yield* new AccountUnavailable({
        code: accountUnavailableCode,
        message: accountUnavailableMessage,
      });
    }
    return auth;
  }
);

/** Resolve one session-validated account before querying or mutating its data. */
export const requireAuth = Effect.fn("auth.require")(function* (
  ctx: QueryCtx | MutationCtx
) {
  const authUser = yield* requireSession(ctx);
  const appUser = yield* readAppUser(ctx, authUser._id);
  if (!appUser || isAccountDeletionPending(appUser)) {
    return yield* new AccountUnavailable({
      code: accountUnavailableCode,
      message: accountUnavailableMessage,
    });
  }
  return { appUser, authUser };
});

/** Actions use the generated query codec to resolve their app identity. */
export const requireAuthForAction = Effect.fn("auth.requireAction")(function* (
  ctx: ActionCtx
) {
  const authUser = yield* requireSession(ctx);
  const appUser = yield* Effect.gen(function* () {
    const runQuery = yield* QueryRunner.QueryRunner;
    return yield* runQuery(refs.internal.users.queries.getUserByAuthId, {
      authId: authUser._id,
    });
  }).pipe(
    Effect.provide(QueryRunner.layer(ctx.runQuery)),
    Effect.mapError(authReadFailure)
  );
  if (!appUser || isAccountDeletionPending(appUser)) {
    return yield* new AccountUnavailable({
      code: accountUnavailableCode,
      message: accountUnavailableMessage,
    });
  }
  return { appUser, authUser };
});
