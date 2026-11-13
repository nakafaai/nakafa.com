import { components } from "@repo/backend/confect/_generated/components";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { insertAccount } from "@repo/backend/confect/auth/account";
import { loginAddress } from "@repo/backend/confect/identity/address";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { randomUuid } from "@repo/utilities/uuid";
import { Array as Arr, Effect, Option } from "effect";

/**
 * The shortest and the longest password a school account takes, in characters:
 * the bounds of Convex Auth's password component, so a card never asks for more
 * than it must.
 */
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 100;

/** Leading or trailing whitespace, which the password component refuses. */
const SURROUNDING_SPACE = /^\s|\s$/u;

/**
 * Why the password component would refuse a password's form, checked before
 * anything is written: too short, too long, or spaces at its ends, which a
 * person cannot see they typed.
 */
export const passwordFormatRefusal = (password: string) => {
  const length = [...password].length;
  if (length < MIN_PASSWORD_LENGTH) {
    return Option.some("passwordTooShort" as const);
  }
  if (length > MAX_PASSWORD_LENGTH) {
    return Option.some("passwordTooLong" as const);
  }
  return SURROUNDING_SPACE.test(password)
    ? Option.some("passwordRejected" as const)
    : Option.none();
};

/**
 * Creates the account of a Person that has none, and its username in Convex
 * Auth's username component, which is the account's own id: a school login name
 * resolves to the account (`identity/logins`), so the sign-in never sees a name
 * a visitor could guess (ADR 0009). Its placeholder address is named by a random
 * key, which holds no name and has no mailbox, so it gets no welcome email.
 */
export const createLoginAccount = Effect.fn("identity.account.create")(
  function* (name: string) {
    const key = yield* randomUuid;
    const userId = yield* insertAccount({
      email: loginAddress(key),
      name,
      seed: key,
    });
    const ctx = yield* MutationCtx;
    const stored = yield* Effect.promise(() =>
      ctx.runMutation(components.authUsername.public.setUsername, {
        userId,
        username: userId,
      })
    );
    if (!stored.success) {
      return yield* Effect.die(
        `The username component refused an account id: ${stored.userError.error}.`
      );
    }
    return userId;
  }
);

/**
 * Stores the password a student chose on a card, replacing any earlier one, and
 * ends every session of the account, so a reissued card locks out whoever held
 * the old password. Convex Auth's password component hashes it and answers why
 * it refuses one: too short or long, spaces at its ends, or too common.
 * https://docs.convex.dev/auth/convex-auth/methods/username-password
 */
export const setLoginPassword = Effect.fn("identity.account.password")(
  function* (userId: Id<"users">, password: string) {
    const ctx = yield* MutationCtx;
    const stored = yield* Effect.promise(() =>
      ctx.runMutation(components.authPassword.public._internal_dangerous_setPassword, {
        minimumLength: MIN_PASSWORD_LENGTH,
        password,
        userId,
      })
    );
    if (!stored.success) {
      return stored.userError.error;
    }
    const sessions = yield* Effect.promise(() =>
      ctx.runQuery(components.auth.public.listSessions, { userId })
    );
    yield* Effect.promise(() =>
      ctx.runMutation(components.auth.public.revokeSessions, {
        sessionIds: Arr.map(sessions, ({ sessionId }) => sessionId),
      })
    );
    return null;
  }
);
