import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { getCreditResetGrantTransaction } from "@repo/backend/confect/modules/commerce/credits.policy";
import { resolveUserCreditState } from "@repo/backend/confect/modules/commerce/credits.service";
import {
  getAppUserByAuthId,
  requireAppUser,
} from "@repo/backend/confect/modules/identity/auth.service";
import type {
  GetUserByAuthIdArgs,
  GetUserByIdArgs,
  UpdateUserNameArgs,
  UpdateUserRoleArgs,
} from "@repo/backend/confect/modules/identity/users.schemas";
import { components } from "@repo/backend/confect/modules/integrations/convexComponents";
import { Clock, Effect } from "effect";

/** Updates the current user's self-selected role. */
export const updateUserRole = Effect.fn("identity.updateUserRole")(function* (
  args: UpdateUserRoleArgs
) {
  const writer = yield* DatabaseWriter;
  const user = yield* requireAppUser();

  yield* writer.table("users").patch(user.appUser._id, {
    role: args.role,
  });

  return null;
});

/** Updates the current user's Better Auth and app profile name. */
export const updateUserName = Effect.fn("identity.updateUserName")(function* (
  args: UpdateUserNameArgs
) {
  const ctx = yield* MutationCtx;
  const writer = yield* DatabaseWriter;
  const user = yield* requireAppUser();

  yield* Effect.promise(() =>
    ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: "user",
        update: { name: args.name },
        where: [{ field: "_id", value: user.authUser._id }],
      },
    })
  );
  yield* writer.table("users").patch(user.appUser._id, {
    name: args.name,
  });

  return null;
});

/** Synchronizes user metadata needed before starting or continuing a chat. */
export const syncUserInfoForChat = Effect.fn("identity.syncUserInfoForChat")(
  function* () {
    const writer = yield* DatabaseWriter;
    const user = yield* requireAppUser();
    const now = yield* Clock.currentTimeMillis;
    const effectiveCredits = yield* resolveUserCreditState({
      now,
      user: user.appUser,
    });
    const creditResetGrant = getCreditResetGrantTransaction(
      user.appUser,
      effectiveCredits
    );

    if (
      effectiveCredits.credits === user.appUser.credits &&
      effectiveCredits.creditsResetAt === user.appUser.creditsResetAt
    ) {
      return {
        credits: effectiveCredits.credits,
        role: user.appUser.role ?? null,
        userId: user.appUser._id,
      };
    }

    yield* writer.table("users").patch(user.appUser._id, {
      credits: effectiveCredits.credits,
      creditsResetAt: effectiveCredits.creditsResetAt,
    });

    if (creditResetGrant) {
      yield* writer.table("creditTransactions").insert({
        userId: user.appUser._id,
        ...creditResetGrant,
      });
    }

    return {
      credits: effectiveCredits.credits,
      role: user.appUser.role ?? null,
      userId: user.appUser._id,
    };
  }
);

/** Reads a user document by app user id for internal callers. */
export const getUserById = Effect.fn("identity.getUserById")(function* (
  args: GetUserByIdArgs
) {
  const reader = yield* DatabaseReader;
  return yield* reader
    .table("users")
    .get(args.userId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));
});

/** Reads a user document by Better Auth id for internal callers. */
export const getUserByAuthId = Effect.fn("identity.getUserByAuthId")(function* (
  args: GetUserByAuthIdArgs
) {
  return yield* getAppUserByAuthId(args.authId);
});

/** User service accessors used by Confect function implementations. */
export class Users extends Effect.Service<Users>()("Users", {
  accessors: true,
  succeed: {
    getUserByAuthId,
    getUserById,
    syncUserInfoForChat,
    updateUserName,
    updateUserRole,
  },
}) {}
