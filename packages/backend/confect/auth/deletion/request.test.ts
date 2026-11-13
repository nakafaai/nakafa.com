import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import {
  createConvexTestWithAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr } from "effect";

const NOW = Date.UTC(2026, 10, 13, 9, 0, 0);
const finalizeName = Ref.getConvexFunctionName(
  refs.internal.auth.deletion.workflow.finalize
);

/** The Convex Auth sessions of one account that still exist. */
function sessionsOf(
  t: ReturnType<typeof createConvexTestWithAuth>,
  userId: Id<"users">
) {
  return t.query((ctx) =>
    ctx.runQuery(components.auth.public.listSessions, { userId })
  );
}

describe("auth/deletion/request", () => {
  it("refuses a caller without a session", async () => {
    const t = createConvexTestWithAuth();
    await expect(
      t.mutation(api.auth.deletion.deleteAccount, {})
    ).rejects.toMatchObject({
      data: { _tag: "SessionRequired", code: "UNAUTHENTICATED" },
    });
  });

  it("ends every session, frees the school username and marks the account deleted in one transaction", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const t = createConvexTestWithAuth();
    const owner = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "deleting-owner" })
    );
    const other = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "other-learner" })
    );
    // A second device of the owner, and the username a school card gives.
    await t.mutation(async (ctx) => {
      await ctx.runMutation(components.auth.public._internal_dangerous_signIn, {
        accessTokenTtlSeconds: 900,
        claims: { method: "test", profile: {} },
        componentPath: "test",
        refreshInactivityTimeoutSeconds: 604_800,
        sessionMaxLifetimeSeconds: 7_776_000,
        userId: owner.userId,
      });
      await ctx.runMutation(components.authUsername.public.setUsername, {
        userId: owner.userId,
        username: owner.userId,
      });
    });
    await expect(sessionsOf(t, owner.userId)).resolves.toHaveLength(2);
    const signedIn = t.withIdentity({ subject: owner.sessionId });
    await expect(
      signedIn.mutation(api.auth.deletion.deleteAccount, {})
    ).resolves.toBeNull();

    await expect(sessionsOf(t, owner.userId)).resolves.toEqual([]);
    await expect(
      t.query((ctx) =>
        ctx.runQuery(components.authUsername.public.getUsername, {
          userId: owner.userId,
        })
      )
    ).resolves.toBeNull();
    // convex-test runs a mutation after the setup that committed before it.
    const deleted = await t.query((ctx) => ctx.db.get("users", owner.userId));
    expect(deleted?.deletedAt).toBeGreaterThanOrEqual(NOW);
    // The ended session resolves to nobody at once, and the finalize step waits.
    await expect(
      signedIn.query(api.auth.queries.getCurrentUser, {})
    ).resolves.toBeNull();
    await expect(
      t.query(async (ctx) =>
        Arr.map(
          Arr.filter(
            await ctx.db.system.query("_scheduled_functions").collect(),
            (job) => job.name === finalizeName
          ),
          (job) => job.args
        )
      )
    ).resolves.toEqual([[{ userId: owner.userId }]]);
    // Another learner's session is untouched.
    await expect(sessionsOf(t, other.userId)).resolves.toHaveLength(1);
  });
});
