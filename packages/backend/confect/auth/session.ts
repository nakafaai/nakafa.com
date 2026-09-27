import type { UsersDoc } from "@repo/backend/confect/_generated/docs";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import type { authReader } from "@repo/backend/confect/auth/reader";
import {
  AccountUnavailable,
  accountUnavailableCode,
  accountUnavailableMessage,
  SessionRequired,
} from "@repo/backend/confect/auth/spec";
import { Context, Effect } from "effect";

type AuthUser = NonNullable<
  Awaited<ReturnType<typeof authReader.safeGetAuthUser>>
>;

/** Better Auth validates the session; the middleware resolves its app identity once. */
export class Session extends Context.Service<
  Session,
  {
    readonly authUser: AuthUser | undefined;
    readonly appUser: UsersDoc | null;
  }
>()("@repo/backend/auth/Session") {}

/** Prepared users remain readable for account recovery. */
export const getOptionalAppUserForRead = Effect.fn("auth.optionalRead")(
  function* () {
    const { authUser, appUser } = yield* Session;
    return authUser && appUser && appUser.deletedAt === undefined
      ? {
          appUser,
          authUser,
        }
      : null;
  }
);

/** Prepared sessions cannot create new writes as anonymous users. */
export const getOptionalActiveAppUser = Effect.fn("auth.optionalWrite")(
  function* () {
    const { authUser, appUser } = yield* Session;
    if (authUser && (!appUser || isAccountDeletionPending(appUser))) {
      return yield* new AccountUnavailable({
        code: accountUnavailableCode,
        message: accountUnavailableMessage,
      });
    }
    return authUser && appUser
      ? {
          appUser,
          authUser,
        }
      : null;
  }
);

/** Requires the session and active account supplied by authentication middleware. */
export const requireAuth = Effect.fn("auth.require")(function* () {
  const { authUser, appUser } = yield* Session;
  if (!authUser) {
    return yield* new SessionRequired({
      code: "UNAUTHENTICATED",
      message: "Unauthenticated",
    });
  }
  if (!appUser || isAccountDeletionPending(appUser)) {
    return yield* new AccountUnavailable({
      code: accountUnavailableCode,
      message: accountUnavailableMessage,
    });
  }
  return {
    appUser,
    authUser,
  };
});
