import { FunctionImpl, GroupImpl } from "@confect/server";
import { components } from "@repo/backend/confect/_generated/components";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseWriter,
  MutationCtx as MutationCtxService,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import {
  getCreditResetGrantTransaction,
  resolveEffectiveCreditState,
} from "@repo/backend/confect/credits/state";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import spec from "@repo/backend/confect/users/mutations.spec";
import { Clock, Effect, Layer } from "effect";

const updateUserRole = FunctionImpl.make(
  databaseSchema,
  spec,
  "updateUserRole",
  Effect.fn("users.mutations.updateUserRole")(function* (args) {
    const writer = yield* DatabaseWriter;
    const user = yield* requireAuth();
    yield* writer
      .table("users")
      .patch(user.appUser._id, {
        role: args.role,
      })
      .pipe(Effect.orDie);
    return null;
  })
);
const updateUserName = FunctionImpl.make(
  databaseSchema,
  spec,
  "updateUserName",
  Effect.fn("users.mutations.updateUserName")(function* (args) {
    const ctx = yield* MutationCtxService;
    const writer = yield* DatabaseWriter;
    const user = yield* requireAuth();

    // Update Better Auth user table
    yield* Effect.promise(async () =>
      ctx.runMutation(components.betterAuth.mutations.updateUserName, {
        authId: user.authUser._id,
        name: args.name,
      })
    );

    // Sync to app user table (manual sync since triggers don't fire)
    yield* writer
      .table("users")
      .patch(user.appUser._id, {
        name: args.name,
      })
      .pipe(Effect.orDie);
    return null;
  })
);
const syncUserInfoForChat = FunctionImpl.make(
  databaseSchema,
  spec,
  "syncUserInfoForChat",
  Effect.fn("users.mutations.syncUserInfoForChat")(function* () {
    const writer = yield* DatabaseWriter;
    const user = yield* requireAuth();
    const effectiveCredits = yield* resolveEffectiveCreditState(
      user.appUser,
      yield* Clock.currentTimeMillis
    );
    const creditResetGrant = getCreditResetGrantTransaction(
      user.appUser,
      effectiveCredits
    );
    if (!creditResetGrant) {
      return {
        role: user.appUser.role ?? null,
        credits: effectiveCredits.credits,
        userId: user.appUser._id,
      };
    }
    yield* writer
      .table("users")
      .patch(user.appUser._id, {
        credits: effectiveCredits.credits,
        creditsResetAt: effectiveCredits.creditsResetAt,
      })
      .pipe(Effect.orDie);
    yield* writer
      .table("creditTransactions")
      .insert({
        userId: user.appUser._id,
        ...creditResetGrant,
      })
      .pipe(Effect.orDie);
    return {
      role: user.appUser.role ?? null,
      credits: effectiveCredits.credits,
      userId: user.appUser._id,
    };
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(updateUserRole),
  Layer.provide(updateUserName),
  Layer.provide(syncUserInfoForChat),
  Layer.provide(atomic),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
