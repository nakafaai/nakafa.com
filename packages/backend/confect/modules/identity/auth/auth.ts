import { betterAuthUserSchema } from "@repo/backend/confect/modules/identity/auth/auth.schemas";
import {
  cleanupDeletedAuthUser,
  createSyncedAuthUser,
  syncUpdatedAuthUser,
} from "@repo/backend/confect/modules/identity/auth/triggers.service";
import { components } from "@repo/backend/convex/_generated/api";
import { internalMutationGeneric } from "convex/server";
import { v } from "convex/values";
import { Effect, Schema } from "effect";

const decodeAuthUser = Schema.decodeUnknown(betterAuthUserSchema);

/**
 * Native Better Auth trigger adapter registered through Confect's plain Convex
 * function boundary.
 *
 * References:
 * - https://confect.dev/server/plain-convex-functions
 * - https://github.com/get-convex/better-auth/blob/main/src/client/create-client.ts
 */
export const onCreate = internalMutationGeneric({
  args: {
    doc: v.any(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.model !== "user") {
      return null;
    }

    const authUser = await Effect.runPromise(
      decodeAuthUser(args.doc).pipe(Effect.orDie)
    );
    await Effect.runPromise(
      createSyncedAuthUser(ctx, authUser, (authId, userId) =>
        ctx.runMutation(components.betterAuth.adapter.updateOne, {
          input: {
            model: "user",
            update: { userId },
            where: [{ field: "_id", value: authId }],
          },
        })
      )
    );

    return null;
  },
});

/** Mirrors Better Auth user updates into the app user graph. */
export const onUpdate = internalMutationGeneric({
  args: {
    newDoc: v.any(),
    oldDoc: v.any(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.model !== "user") {
      return null;
    }

    const newAuthUser = await Effect.runPromise(
      decodeAuthUser(args.newDoc).pipe(Effect.orDie)
    );
    const oldAuthUser = await Effect.runPromise(
      decodeAuthUser(args.oldDoc).pipe(Effect.orDie)
    );
    await Effect.runPromise(
      syncUpdatedAuthUser(ctx, newAuthUser, oldAuthUser).pipe(Effect.orDie)
    );

    return null;
  },
});

/** Mirrors Better Auth user deletes into scheduled app cleanup. */
export const onDelete = internalMutationGeneric({
  args: {
    doc: v.any(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.model !== "user") {
      return null;
    }

    const authUser = await Effect.runPromise(
      decodeAuthUser(args.doc).pipe(Effect.orDie)
    );
    await Effect.runPromise(cleanupDeletedAuthUser(ctx, authUser));

    return null;
  },
});
