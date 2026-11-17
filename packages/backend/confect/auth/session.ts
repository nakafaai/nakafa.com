import type { UsersDoc } from "@repo/backend/confect/_generated/docs";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import {
  AccountUnavailable,
  accountUnavailableCode,
  accountUnavailableMessage,
  SessionRequired,
} from "@repo/backend/confect/auth/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Context, Effect } from "effect";

/**
 * The caller's account, resolved once per function by the session middleware:
 * the user id that the caller's live Convex Auth session or agent grant names,
 * and that user's row. `userId` without `appUser` is a signed-in caller whose
 * account is gone.
 */
export class Session extends Context.Service<
  Session,
  {
    readonly userId: Id<"users"> | undefined;
    readonly appUser: UsersDoc | null;
  }
>()("@repo/backend/confect/auth/session") {}

/** Prepared users remain readable for account recovery. */
export const getOptionalAppUserForRead = Effect.fn("auth.optionalRead")(
  function* () {
    const { appUser } = yield* Session;
    return appUser && appUser.deletedAt === undefined ? { appUser } : null;
  }
);

/** Prepared sessions cannot create new writes as anonymous users. */
export const getOptionalActiveAppUser = Effect.fn("auth.optionalWrite")(
  function* () {
    const { userId, appUser } = yield* Session;
    if (userId && (!appUser || isAccountDeletionPending(appUser))) {
      return yield* new AccountUnavailable({
        code: accountUnavailableCode,
        message: accountUnavailableMessage,
      });
    }
    return appUser ? { appUser } : null;
  }
);

/** Requires the session and active account supplied by authentication middleware. */
export const requireAuth = Effect.fn("auth.require")(function* () {
  const { userId, appUser } = yield* Session;
  if (!userId) {
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
  return { appUser };
});
