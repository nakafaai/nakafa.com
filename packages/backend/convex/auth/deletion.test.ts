import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 6, 28, 12, 0, 0);
const ATTEMPT_ID = "019fa44c-02be-7cd0-a4ed-61a7af8e0620";

describe("auth/deletion", () => {
  it("lets a prepared auth session cancel its own deletion", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "cancel-current-deletion",
      })
    );
    await t.mutation(async (ctx) => {
      await ctx.db.patch("users", identity.userId, {
        deletionPreparedAt: NOW,
      });
      await ctx.db.insert("accountDeletionPreparations", {
        attemptId: ATTEMPT_ID,
        authId: identity.authUserId,
        recoveryGeneration: 0,
        userId: identity.userId,
      });
    });

    await t
      .withIdentity({
        sessionId: identity.sessionId,
        subject: identity.authUserId,
      })
      .mutation(api.auth.deletion.cancelCurrentAccountDeletion, {
        attemptId: ATTEMPT_ID,
      });

    const state = await t.query(async (ctx) => ({
      preparation: await ctx.db.query("accountDeletionPreparations").unique(),
      user: await ctx.db.get("users", identity.userId),
    }));

    expect(state.preparation).toBeNull();
    expect(state.user).not.toHaveProperty("deletionPreparedAt");
  });
});
