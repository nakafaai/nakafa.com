import { expect, it } from "@effect/vitest";
import { createDeletedUserTombstone } from "@repo/backend/confect/auth/deletion/tombstone";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { internal } from "@repo/backend/convex/_generated/api";

it("shreds the deleted learner's vault key and keeps another learner's", async () => {
  const now = Date.UTC(2026, 9, 10);
  const t = createConvexTestWithBetterAuth();
  const { owner, retained } = await t.mutation(async (ctx) => {
    const deleted = await seedAuthenticatedUser(ctx, {
      now,
      suffix: "vault-deleted",
    });
    const kept = await seedAuthenticatedUser(ctx, {
      now,
      suffix: "vault-kept",
    });
    await ctx.db.patch(
      deleted.userId,
      createDeletedUserTombstone(deleted.userId, now)
    );
    for (const userId of [deleted.userId, kept.userId]) {
      await ctx.db.insert("vaultKeys", {
        createdAt: now,
        root: "test",
        userId,
        wrapped: new ArrayBuffer(61),
      });
    }
    return { owner: deleted.userId, retained: kept.userId };
  });
  const cleanup = () =>
    t.mutation(internal.auth.cleanup.cleanupDeletedUser, { userId: owner });
  let passes = 0;
  while (await cleanup()) {
    passes += 1;
  }
  expect(passes).toBeGreaterThan(0);
  expect(await t.query((ctx) => ctx.db.query("vaultKeys").collect())).toEqual([
    expect.objectContaining({ userId: retained }),
  ]);
});
