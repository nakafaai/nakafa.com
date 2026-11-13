import { mutationLayer } from "@confect/server/RegisteredConvexFunction";
import { afterEach, assert, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { readCaller } from "@repo/backend/confect/auth/caller";
import {
  createConvexTestWithAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { AGENT_ISSUER } from "@repo/backend/test/agent/grant";
import { seedAccountAgents } from "@repo/backend/test/deletion/seed";
import { Effect } from "effect";

const NOW = Date.UTC(2026, 10, 13, 9, 0, 0);

const authServer = vi.hoisted(() => ({ failNext: false }));

// The session read is Convex Auth's own; a test makes it fail once to prove
// that a failed read is a typed, sanitized refusal and never a guess.
vi.mock("@convex-dev/auth/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@convex-dev/auth/server")>();
  return {
    ...actual,
    getAuthUserId: (ctx: Parameters<typeof actual.getAuthUserId>[0]) => {
      if (authServer.failNext) {
        authServer.failNext = false;
        return Promise.reject(new Error("private session store detail"));
      }
      return actual.getAuthUserId(ctx);
    },
  };
});

afterEach(() => {
  vi.unstubAllEnvs();
});

type Accessor = Pick<ReturnType<typeof createConvexTestWithAuth>, "mutation">;

/**
 * Reads the caller in one transaction as `accessor`, after `prepare` ran on its
 * context, and answers it as plain data: the ids it resolved, or the typed
 * failure's tag, code and message, which is all a caller ever sees of it.
 */
function callerOf(
  accessor: Accessor,
  prepare: (ctx: MutationCtx) => void = () => undefined
) {
  return accessor.mutation((ctx) => {
    prepare(ctx);
    return Effect.runPromise(
      readCaller(ctx).pipe(
        Effect.provide(mutationLayer(confectSchema, ctx)),
        Effect.match({
          onFailure: ({ _tag, code, message }) => ({
            failure: { _tag, code, message },
          }),
          onSuccess: ({ appUser, userId }) => ({
            appUser: appUser?._id ?? null,
            userId: userId ?? null,
          }),
        })
      )
    );
  });
}

/** One live grant of an agent that `userId` let in. */
async function grantOf(
  t: ReturnType<typeof createConvexTestWithAuth>,
  userId: Parameters<typeof seedAccountAgents>[1]
) {
  return await t.mutation(async (ctx) => {
    await seedAccountAgents(ctx, userId, 1, NOW);
    const grant = await ctx.db
      .query("agentGrants")
      .withIndex("by_userId", (query) => query.eq("userId", userId))
      .unique();
    assert(grant !== null, "Expected the seeded grant.");
    return grant._id;
  });
}

const AUTH_READ_FAILED = {
  failure: {
    _tag: "AuthReadError",
    code: "AUTH_READ_FAILED",
    message: "Unable to read authentication state.",
  },
};

/** A caller that resolves to nobody. */
const NOBODY = { appUser: null, userId: null };

describe("auth/caller", () => {
  it("answers nobody for a caller without a token", async () => {
    const t = createConvexTestWithAuth();
    await expect(callerOf(t)).resolves.toEqual(NOBODY);
  });

  it("resolves a live session to its user, and an ended one to nobody at once", async () => {
    const t = createConvexTestWithAuth();
    const learner = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "session" })
    );
    const signedIn = t.withIdentity({ subject: learner.sessionId });
    await expect(callerOf(signedIn)).resolves.toEqual({
      appUser: learner.userId,
      userId: learner.userId,
    });
    await t.mutation((ctx) =>
      ctx.runMutation(components.auth.public.revokeSessions, {
        sessionIds: [learner.sessionId],
      })
    );
    await expect(callerOf(signedIn)).resolves.toEqual(NOBODY);
  });

  it("answers the user without a row when the session's account row is gone", async () => {
    const t = createConvexTestWithAuth();
    const learner = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "gone" })
    );
    await t.mutation((ctx) => ctx.db.delete("users", learner.userId));
    await expect(
      callerOf(t.withIdentity({ subject: learner.sessionId }))
    ).resolves.toEqual({ appUser: null, userId: learner.userId });
  });

  it("resolves an agent's token through its grant, and a revoked or malformed one to nobody", async () => {
    const t = createConvexTestWithAuth();
    const issuer = AGENT_ISSUER;
    const learner = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "agent-owner" })
    );
    const grantId = await grantOf(t, learner.userId);
    const agent = t.withIdentity({ issuer, subject: grantId });
    await expect(callerOf(agent)).resolves.toEqual({
      appUser: learner.userId,
      userId: learner.userId,
    });
    await t.mutation((ctx) => ctx.db.delete("agentGrants", grantId));
    await expect(callerOf(agent)).resolves.toEqual(NOBODY);
    await expect(
      callerOf(t.withIdentity({ issuer, subject: "not-a-grant" }))
    ).resolves.toEqual(NOBODY);
  });

  it("refuses with a typed, sanitized error when the session store cannot be read", async () => {
    const t = createConvexTestWithAuth();
    const learner = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "store-down" })
    );
    authServer.failNext = true;
    await expect(
      callerOf(t.withIdentity({ subject: learner.sessionId }))
    ).resolves.toEqual(AUTH_READ_FAILED);
  });

  it("refuses when the deployment's address is unknown, since no issuer can be told apart", async () => {
    const t = createConvexTestWithAuth();
    const learner = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "no-address" })
    );
    vi.stubEnv("CONVEX_CLOUD_URL", undefined);
    await expect(
      callerOf(t.withIdentity({ subject: learner.sessionId }))
    ).resolves.toEqual(AUTH_READ_FAILED);
  });

  it("refuses when a grant or an account row cannot be read", async () => {
    const t = createConvexTestWithAuth();
    const learner = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "rows-down" })
    );
    const grantId = await grantOf(t, learner.userId);
    const failRead = (ctx: MutationCtx) => {
      vi.spyOn(ctx.db, "get").mockRejectedValueOnce(new Error("db offline"));
    };
    await expect(
      callerOf(
        t.withIdentity({
          issuer: AGENT_ISSUER,
          subject: grantId,
        }),
        failRead
      )
    ).resolves.toEqual(AUTH_READ_FAILED);
    await expect(
      callerOf(t.withIdentity({ subject: learner.sessionId }), failRead)
    ).resolves.toEqual(AUTH_READ_FAILED);
  });
});
