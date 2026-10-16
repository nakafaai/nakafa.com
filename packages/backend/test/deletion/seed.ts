import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { MASCOT_CODE } from "@repo/backend/test/mascot";

/** Inserts one app user with optional deletion state. */
export function seedDeletionUser(
  ctx: MutationCtx,
  authId: string,
  state: {
    readonly deletedAt?: number;
    readonly deletionPreparedAt?: number;
  } = {}
) {
  return ctx.db.insert("users", {
    authId,
    credits: 0,
    creditsResetAt: 0,
    email: `${authId}@example.com`,
    mascot: MASCOT_CODE,
    name: authId,
    plan: "free",
    ...state,
  });
}

/** Seeds one user whose account deletion was prepared by one browser attempt. */
export async function seedPreparedDeletion(
  ctx: MutationCtx,
  authId: string,
  now: number,
  attemptId: string
) {
  const userId = await seedDeletionUser(ctx, authId, {
    deletionPreparedAt: now,
  });
  const preparationId = await ctx.db.insert("accountDeletionPreparations", {
    attemptId,
    authId,
    recoveryAt: now,
    recoveryGeneration: 0,
    userId,
  });

  return { preparationId, userId };
}
