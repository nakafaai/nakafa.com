import { afterEach, describe, expect, it } from "@effect/vitest";
import { CODE_LIFETIME } from "@repo/backend/confect/auth/grant/token";
import {
  createConvexTestWithAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import {
  authorizeTestAgent,
  challengeOf,
  REDIRECT,
  registerTestAgent,
  VERIFIER,
} from "@repo/backend/test/agent/grant";
import { sha256Hex } from "@repo/utilities/digest";
import { Duration, Effect, Schema } from "effect";

const NOW = Date.UTC(2026, 10, 13, 9, 0, 0);

describe("auth/grant/authorize", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("describes an agent by the name it gave and the host of its first address", async () => {
    const t = createConvexTestWithAuth();
    const web = await registerTestAgent(t, "Web Agent");
    const { clientId: native } = await t.mutation(api.auth.grant.register, {
      name: "Native Agent",
      redirectUris: ["com.example.agent:/callback"],
    });
    await expect(
      t.query(api.auth.grant.describe, { clientId: web })
    ).resolves.toEqual({ name: "Web Agent", redirect: "agent.example" });
    // A custom scheme names no host, so the page shows none.
    await expect(
      t.query(api.auth.grant.describe, { clientId: native })
    ).resolves.toEqual({ name: "Native Agent", redirect: null });
    await expect(
      t.query(api.auth.grant.describe, { clientId: "not-a-client" })
    ).resolves.toBeNull();
  });

  it.effect("gives a signed-in person's agent a code that only its hash and challenge are kept of", () =>
    Effect.gen(function* () {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
      const t = createConvexTestWithAuth();
      const learner = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          seedAuthenticatedUser(ctx, { now: NOW, suffix: "consent" })
        )
      );
      const clientId = yield* Effect.promise(() => registerTestAgent(t));
      const code = yield* Effect.promise(() =>
        authorizeTestAgent(t, learner.sessionId, clientId)
      );
      const stored = yield* Effect.promise(() =>
        t.query((ctx) => ctx.db.query("agentCodes").unique())
      );
      expect(stored).toMatchObject({
        clientId,
        codeChallenge: yield* Effect.promise(() => challengeOf(VERIFIER)),
        codeHash: yield* sha256Hex(code),
        redirectUri: REDIRECT,
        userId: learner.userId,
      });
      // The code lives `CODE_LIFETIME` from the moment it was given, a moment
      // after the setup's commit.
      expect(
        (stored?.expiresAt ?? 0) - Duration.toMillis(CODE_LIFETIME)
      ).toBeGreaterThanOrEqual(NOW);
      expect(
        yield* Schema.encodeEffect(Schema.UnknownFromJsonString)(stored)
      ).not.toContain(code);
    })
  );

  it("refuses a caller without a session, an unknown agent, a foreign address and a missing S256 challenge", async () => {
    const t = createConvexTestWithAuth();
    const learner = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "refusals" })
    );
    const clientId = await registerTestAgent(t);
    const codeChallenge = await challengeOf(VERIFIER);
    const authorize = (
      args: { clientId: string; codeChallenge: string; redirectUri: string },
      sessionId: string | null = learner.sessionId
    ) =>
      (sessionId === null ? t : t.withIdentity({ subject: sessionId })).mutation(
        api.auth.grant.authorize,
        args
      );
    await expect(
      authorize({ clientId, codeChallenge, redirectUri: REDIRECT }, null)
    ).rejects.toMatchObject({ data: { _tag: "SessionRequired" } });
    const removed = await t.mutation(async (ctx) => {
      const id = await ctx.db.insert("agentClients", {
        name: "Removed",
        redirectUris: [REDIRECT],
      });
      await ctx.db.delete("agentClients", id);
      return id;
    });
    for (const unknown of ["not-a-client", removed]) {
      await expect(
        authorize({ clientId: unknown, codeChallenge, redirectUri: REDIRECT })
      ).rejects.toMatchObject({
        data: { _tag: "AgentRefused", error: "invalid_client" },
      });
    }
    await expect(
      authorize({
        clientId,
        codeChallenge,
        redirectUri: "https://elsewhere.example/callback",
      })
    ).rejects.toMatchObject({
      data: { _tag: "AgentRefused", error: "invalid_redirect_uri" },
    });
    await expect(
      authorize({ clientId, codeChallenge: "plain", redirectUri: REDIRECT })
    ).rejects.toMatchObject({
      data: { _tag: "AgentRefused", error: "invalid_request" },
    });
    await expect(
      t.query((ctx) => ctx.db.query("agentCodes").collect())
    ).resolves.toEqual([]);
  });
});
