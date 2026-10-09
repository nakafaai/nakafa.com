import type { UsersDoc } from "@repo/backend/confect/_generated/docs";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import {
  AccountUnavailable,
  accountUnavailableCode,
  accountUnavailableMessage,
  SessionRequired,
} from "@repo/backend/confect/auth/spec";
import { Context, Effect } from "effect";

/**
 * The caller's Better Auth user id and matching app user, resolved once per
 * function by the session middleware. Queries trust the token Convex verified;
 * mutations and actions also confirm the session with Better Auth.
 */
export class Session extends Context.Service<
  Session,
  {
    readonly authId: string | undefined;
    readonly appUser: UsersDoc | null;
  }
>()("@repo/backend/confect/auth/session") {}

/** Prepared users remain readable for account recovery. */
export const getOptionalAppUserForRead = Effect.fn("auth.optionalRead")(
  function* () {
    const { authId, appUser } = yield* Session;
    return authId && appUser && appUser.deletedAt === undefined
      ? {
          appUser,
          authId,
        }
      : null;
  }
);

/** Prepared sessions cannot create new writes as anonymous users. */
export const getOptionalActiveAppUser = Effect.fn("auth.optionalWrite")(
  function* () {
    const { authId, appUser } = yield* Session;
    if (authId && (!appUser || isAccountDeletionPending(appUser))) {
      return yield* AccountUnavailable.make({
        code: accountUnavailableCode,
        message: accountUnavailableMessage,
      });
    }
    return authId && appUser
      ? {
          appUser,
          authId,
        }
      : null;
  }
);

/** Requires the session and active account supplied by authentication middleware. */
export const requireAuth = Effect.fn("auth.require")(function* () {
  const { authId, appUser } = yield* Session;
  if (!authId) {
    return yield* SessionRequired.make({
      code: "UNAUTHENTICATED",
      message: "Unauthenticated",
    });
  }
  if (!appUser || isAccountDeletionPending(appUser)) {
    return yield* AccountUnavailable.make({
      code: accountUnavailableCode,
      message: accountUnavailableMessage,
    });
  }
  return {
    appUser,
    authId,
  };
});
