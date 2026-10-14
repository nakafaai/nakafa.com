import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { Auth } from "@repo/backend/confect/auth/runtime";
import { loginAddress } from "@repo/backend/confect/identity/address";
import { allocateUsername } from "@repo/backend/confect/users/allocation";
import { randomUuid } from "@repo/utilities/uuid";
import { Clock, DateTime, Duration, Effect } from "effect";

/**
 * How long the reset token of one password waits. Better Auth's own reset
 * tokens live for an hour by default, and this token is used at once, in the
 * same transaction that wrote it.
 */
const RESET_TOKEN_TERM = Duration.hours(1);

/**
 * Creates the Better Auth account of a Person that has none. Its global
 * username is allocated here, so the auth trigger reuses it for the app user
 * row, and its address is the placeholder that never receives mail. Better
 * Auth writes the user through its internal adapter, so the trigger runs in
 * the caller's transaction. Returns the Better Auth id and the app user id.
 */
export const createLoginAccount = Effect.fn("identity.account.create")(
  function* (auth: Auth, name: string) {
    const username = yield* allocateUsername(name);
    const context = yield* Effect.promise(() => auth.$context);
    const authUser = yield* Effect.promise(() =>
      context.internalAdapter.createUser({
        email: loginAddress(username),
        emailVerified: false,
        name,
        username,
      })
    );
    const appUser = yield* (yield* DatabaseReader)
      .table("users")
      .get("by_authId", authUser.id)
      .pipe(Effect.orDie);
    return { authId: authUser.id, userId: appUser._id };
  }
);

/**
 * Stores the password a student chose through Better Auth's own reset
 * endpoint. That endpoint hashes the password, creates the credential account
 * when there is none, and replaces the old password when there is one. The
 * caller checks the length first, so a refused password writes nothing.
 */
export const setLoginPassword = Effect.fn("identity.account.password")(
  function* (auth: Auth, authId: string, password: string) {
    const context = yield* Effect.promise(() => auth.$context);
    const token = yield* randomUuid;
    const now = yield* Clock.currentTimeMillis;
    yield* Effect.promise(() =>
      context.internalAdapter.createVerificationValue({
        expiresAt: DateTime.toDateUtc(
          DateTime.makeUnsafe(now + Duration.toMillis(RESET_TOKEN_TERM))
        ),
        identifier: `reset-password:${token}`,
        value: authId,
      })
    );
    yield* Effect.promise(() =>
      auth.api.resetPassword({ body: { newPassword: password, token } })
    );
  }
);
