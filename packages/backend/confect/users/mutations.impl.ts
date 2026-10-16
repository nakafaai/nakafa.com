import { FunctionImpl, GroupImpl } from "@confect/server";
import { components } from "@repo/backend/confect/_generated/components";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseWriter,
  MutationCtx as MutationCtxService,
} from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import { renameAuthUsername } from "@repo/backend/confect/auth/username";
import {
  getCreditResetGrantTransaction,
  resolveEffectiveCreditState,
} from "@repo/backend/confect/credits/state";
import atomic from "@repo/backend/confect/middleware/atomic.impl";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import { inspectUsername } from "@repo/backend/confect/users/availability";
import { readBio } from "@repo/backend/confect/users/bio";
import spec from "@repo/backend/confect/users/mutations.spec";
import { UsernameRejected } from "@repo/backend/confect/users/username";
import { Clock, Effect, Layer, Result, Struct } from "effect";

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
    yield* Effect.promise(() =>
      ctx.runMutation(components.betterAuth.mutations.updateUserName, {
        authId: user.authId,
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

/**
 * Renames the caller's profile address. The old username is free the moment the
 * new one is stored, in the same transaction that checks the new one, so two
 * accounts that ask for the same name at once cannot both win. A school
 * account's Better Auth username changes with it, so the two stay one value.
 */
const updateUsername = FunctionImpl.make(
  databaseSchema,
  spec,
  "updateUsername",
  Effect.fn("users.mutations.updateUsername")(function* (args) {
    const ctx = yield* MutationCtxService;
    const writer = yield* DatabaseWriter;
    const user = yield* requireAuth();
    const inspected = yield* inspectUsername(args.username, user.appUser._id);
    if (Result.isFailure(inspected)) {
      return yield* new UsernameRejected({ reason: inspected.failure });
    }
    yield* renameAuthUsername(ctx, user.authId, inspected.success);
    yield* writer
      .table("users")
      .patch(user.appUser._id, { username: inspected.success })
      .pipe(Effect.orDie);
    return null;
  })
);

/** Stores the caller's bio, or clears it when the text holds nothing. */
const updateBio = FunctionImpl.make(
  databaseSchema,
  spec,
  "updateBio",
  Effect.fn("users.mutations.updateBio")(function* (args) {
    const writer = yield* DatabaseWriter;
    const user = yield* requireAuth();
    const bio = yield* Effect.fromResult(readBio(args.bio));
    yield* writer
      .table("users")
      .patch(user.appUser._id, { bio: bio === "" ? undefined : bio })
      .pipe(Effect.orDie);
    return null;
  })
);

/**
 * Stores the caller's animal and answers the animal it stored. The row that the
 * session loaded is replaced, not patched, because a patch reads the whole row
 * again before it writes.
 */
const setMascot = FunctionImpl.make(
  databaseSchema,
  spec,
  "setMascot",
  Effect.fn("users.mutations.setMascot")(function* (args) {
    const writer = yield* DatabaseWriter;
    const user = yield* requireAuth();
    yield* writer
      .table("users")
      .replace(user.appUser._id, {
        ...Struct.omit(user.appUser, ["_id", "_creationTime"]),
        mascot: args.mascot,
      })
      .pipe(Effect.orDie);
    return { mascot: args.mascot };
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
  Layer.provide(updateUsername),
  Layer.provide(updateBio),
  Layer.provide(setMascot),
  Layer.provide(syncUserInfoForChat),
  Layer.provide(atomic),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
