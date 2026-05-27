import type { GenericId } from "@confect/core";
import {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/confect/_generated/services";
import {
  getCreditResetGrantTransaction,
  resolveEffectiveCreditState,
} from "@repo/backend/confect/modules/commerce/credits.policy";
import {
  getAppUserByAuthId,
  requireAppUser,
} from "@repo/backend/confect/modules/identity/auth.service";
import { components } from "@repo/backend/confect/modules/integrations/convexComponents";
import { Clock, Effect } from "effect";

/** Updates the current user's self-selected role. */
export const updateUserRole = Effect.fn("identity.updateUserRole")(
  function* (args: { role: "teacher" | "student" | "parent" }) {
    const ctx = yield* MutationCtx;
    const user = yield* requireAppUser(ctx);

    yield* Effect.promise(() =>
      ctx.db.patch(user.appUser._id, {
        role: args.role,
      })
    );

    return null;
  }
);

/** Updates the current user's Better Auth and app profile name. */
export const updateUserName = Effect.fn("identity.updateUserName")(
  function* (args: { name: string }) {
    const ctx = yield* MutationCtx;
    const user = yield* requireAppUser(ctx);

    yield* Effect.promise(() =>
      ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "user",
          update: { name: args.name },
          where: [{ field: "_id", value: user.authUser._id }],
        },
      })
    );
    yield* Effect.promise(() =>
      ctx.db.patch(user.appUser._id, {
        name: args.name,
      })
    );

    return null;
  }
);

/** Synchronizes user metadata needed before starting or continuing a chat. */
export const syncUserInfoForChat = Effect.fn("identity.syncUserInfoForChat")(
  function* () {
    const ctx = yield* MutationCtx;
    const user = yield* requireAppUser(ctx);
    const now = yield* Clock.currentTimeMillis;
    const effectiveCredits = yield* Effect.promise(() =>
      resolveEffectiveCreditState(ctx.db, user.appUser, now)
    );
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

    yield* Effect.promise(() =>
      ctx.db.patch(user.appUser._id, {
        credits: effectiveCredits.credits,
        creditsResetAt: effectiveCredits.creditsResetAt,
      })
    );

    if (creditResetGrant) {
      yield* Effect.promise(() =>
        ctx.db.insert("creditTransactions", {
          userId: user.appUser._id,
          ...creditResetGrant,
        })
      );
    }

    return {
      credits: effectiveCredits.credits,
      role: user.appUser.role ?? null,
      userId: user.appUser._id,
    };
  }
);

/** Reads a user document by app user id for internal callers. */
export const getUserById = Effect.fn("identity.getUserById")(function* (args: {
  userId: GenericId.GenericId<"users">;
}) {
  const ctx = yield* QueryCtx;
  return yield* Effect.promise(() => ctx.db.get(args.userId));
});

/** Reads a user document by Better Auth id for internal callers. */
export const getUserByAuthId = Effect.fn("identity.getUserByAuthId")(
  function* (args: { authId: string }) {
    const ctx = yield* QueryCtx;
    return yield* getAppUserByAuthId(ctx, args.authId);
  }
);

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
