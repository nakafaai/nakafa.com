import {
  getOptionalActiveAppUser,
  getOptionalAppUserForRead,
  requireAuth,
  requireAuthForAction,
} from "@repo/backend/convex/lib/helpers/auth";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 6, 28, 11, 0, 0);

describe("lib/helpers/auth", () => {
  it("keeps prepared users readable while rejecting new mutations", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "prepared-auth",
      })
    );
    await t.mutation((ctx) =>
      ctx.db.patch("users", identity.userId, {
        deletionPreparedAt: NOW,
      })
    );
    const authenticated = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    const optionalUserId = await authenticated.query(async (ctx) => {
      const auth = await getOptionalAppUserForRead(ctx);
      return auth?.appUser._id ?? null;
    });
    const activeMutationUserId = await authenticated.mutation(async (ctx) => {
      const auth = await getOptionalActiveAppUser(ctx);
      return auth?.appUser._id ?? null;
    });

    expect(optionalUserId).toBe(identity.userId);
    expect(activeMutationUserId).toBeNull();
    await expect(
      authenticated.query(async (ctx) => await requireAuth(ctx))
    ).rejects.toMatchObject({
      data: {
        code: "UNAUTHORIZED",
      },
    });
  });

  it("rejects prepared users when an in-flight action re-enters Convex", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "prepared-action",
      })
    );
    await t.mutation((ctx) =>
      ctx.db.patch("users", identity.userId, {
        deletionPreparedAt: NOW,
      })
    );

    await expect(
      t
        .withIdentity({
          sessionId: identity.sessionId,
          subject: identity.authUserId,
        })
        .action(async (ctx) => await requireAuthForAction(ctx))
    ).rejects.toMatchObject({
      data: {
        code: "UNAUTHORIZED",
      },
    });
  });
});
