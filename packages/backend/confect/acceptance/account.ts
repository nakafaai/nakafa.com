import { components } from "@repo/backend/confect/_generated/components";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { requireAcceptanceSeed } from "@repo/backend/confect/acceptance/seed";
import { insertAccount } from "@repo/backend/confect/auth/account";
import { setLoginPassword } from "@repo/backend/confect/identity/account";
import { issueToken } from "@repo/utilities/token";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect, Option } from "effect";

/**
 * An account of the acceptance runtime that a browser test signs in to with
 * Convex Auth's password method, since no test can sign in with Google: the
 * live account of the address, or a new one, with a fresh password and its
 * own id as its username. It answers both, which the test signs in with.
 */
export const seedPasswordAccount = Effect.fn("acceptance.account.seed")(
  function* (input: { readonly email: string; readonly name: string }) {
    yield* requireAcceptanceSeed();
    const held = yield* (yield* DatabaseReader)
      .table("users")
      .index("by_email", (query) => query.eq("email", input.email))
      .first()
      .pipe(Effect.orDie);
    const userId = Option.isSome(held)
      ? held.value._id
      : yield* insertAccount({
          email: input.email,
          name: input.name,
          seed: input.email,
        });
    const ctx = yield* MutationCtx;
    yield* Effect.promise(() =>
      ctx.runMutation(components.authUsername.public.setUsername, {
        userId,
        username: userId,
      })
    );
    const { token } = yield* issueToken();
    if ((yield* setLoginPassword(userId, token)) !== null) {
      return yield* Effect.die("A drawn token is not a password Convex Auth takes.");
    }
    return { password: token, userId };
  }
);

/**
 * Writes the profile fields that a browser test names for a synthetic account:
 * its name and its photo address, as the settings page writes them.
 */
export const seedAccountProfile = Effect.fn("acceptance.account.profile")(
  function* (input: {
    readonly image?: string;
    readonly name?: string;
    readonly userId: Id<"users">;
  }) {
    yield* requireAcceptanceSeed();
    yield* (yield* DatabaseWriter)
      .table("users")
      .patch(input.userId, {
        ...(input.image === undefined ? {} : { image: input.image }),
        ...(input.name === undefined ? {} : { name: input.name }),
      })
      .pipe(Effect.orDie);
    return null;
  }
);
