import { assert, describe, expect, it } from "@effect/vitest";
import {
  AGENT_SCOPE,
  AGENT_TOKEN_LIFETIME,
  CODE_LIFETIME,
  GRANT_LIFETIME,
} from "@repo/backend/confect/auth/grant/token";
import {
  createConvexTestWithAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import {
  agentIdentity,
  authorizeTestAgent,
  letAgentIn,
  REDIRECT,
  registerTestAgent,
  VERIFIER,
} from "@repo/backend/test/agent/grant";
import { Duration } from "effect";

const NOW = Date.UTC(2026, 10, 13, 9, 0, 0);
const REFUSED = {
  error: "invalid_grant",
  error_description: "The grant is invalid, expired, or revoked.",
  outcome: "refused",
};

type BackendTest = ReturnType<typeof createConvexTestWithAuth>;

/** A signed-in learner and a registered agent, at `NOW`. */
async function setUp() {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  const t = createConvexTestWithAuth();
  const learner = await t.mutation((ctx) =>
    seedAuthenticatedUser(ctx, { now: NOW, suffix: "agent-owner" })
  );
  const clientId = await registerTestAgent(t);
  return { clientId, learner, t };
}

/** Every row an agent's codes and grants hold. */
function agentRows(t: BackendTest) {
  return t.query(async (ctx) => ({
    codes: await ctx.db.query("agentCodes").collect(),
    grants: await ctx.db.query("agentGrants").collect(),
  }));
}

describe("auth/grant/exchange code", () => {
  it("trades a code once for tokens whose subject is the new grant, and spends it", async () => {
    const { clientId, learner, t } = await setUp();
    const code = await authorizeTestAgent(t, learner.sessionId, clientId);
    const exchange = {
      clientId,
      code,
      codeVerifier: VERIFIER,
      redirectUri: REDIRECT,
    };
    const answer = await t.mutation(api.auth.grant.exchange, exchange);
    expect(answer).toMatchObject({
      outcome: "issued",
      tokens: {
        access_token: expect.any(String),
        expires_in: Duration.toSeconds(AGENT_TOKEN_LIFETIME),
        refresh_token: expect.any(String),
        scope: AGENT_SCOPE,
        token_type: "Bearer",
      },
    });
    if (answer.outcome !== "issued") {
      return;
    }
    const rows = await agentRows(t);
    expect(rows.codes).toEqual([]);
    expect(rows.grants).toEqual([
      expect.objectContaining({
        clientId,
        refreshedAt: expect.any(Number),
        userId: learner.userId,
      }),
    ]);
    const identity = agentIdentity(answer.tokens.access_token);
    expect(identity.subject).toBe(rows.grants[0]?._id);
    // The agent acts as its person, through the grant.
    await expect(
      t.withIdentity(identity).query(api.auth.queries.getCurrentUser, {})
    ).resolves.toMatchObject({ appUser: { _id: learner.userId } });
    await expect(
      t.mutation(api.auth.grant.exchange, exchange)
    ).resolves.toEqual(REFUSED);
  });

  it("refuses an unknown agent before it reads any code", async () => {
    const { clientId, learner, t } = await setUp();
    const code = await authorizeTestAgent(t, learner.sessionId, clientId);
    await expect(
      t.mutation(api.auth.grant.exchange, {
        clientId: "not-a-client",
        code,
        codeVerifier: VERIFIER,
        redirectUri: REDIRECT,
      })
    ).rejects.toMatchObject({
      data: { _tag: "AgentRefused", error: "invalid_client" },
    });
    await expect(agentRows(t)).resolves.toMatchObject({
      codes: [expect.objectContaining({ clientId })],
    });
  });

  it.each([
    ["an unknown code", { code: "not-a-code" }],
    ["another agent's code", { otherAgent: true }],
    ["another redirect address", { redirectUri: `${REDIRECT}/other` }],
    ["a wrong verifier", { codeVerifier: `${VERIFIER}-wrong` }],
    ["a stale code", { late: true }],
    ["a deleted account", { deleted: true }],
  ] as const)("spends the code and answers one refusal for %s", async (_case, change) => {
    const { clientId, learner, t } = await setUp();
    const code = await authorizeTestAgent(t, learner.sessionId, clientId);
    const other =
      "otherAgent" in change ? await registerTestAgent(t, "Other") : clientId;
    if ("late" in change) {
      // Past the lifetime of a code given a moment after the setup.
      vi.setSystemTime(NOW + Duration.toMillis(CODE_LIFETIME) + 1000);
    }
    if ("deleted" in change) {
      await t.mutation((ctx) =>
        ctx.db.patch("users", learner.userId, { deletedAt: NOW })
      );
    }
    await expect(
      t.mutation(api.auth.grant.exchange, {
        clientId: other,
        code: "code" in change ? change.code : code,
        codeVerifier: "codeVerifier" in change ? change.codeVerifier : VERIFIER,
        redirectUri: "redirectUri" in change ? change.redirectUri : REDIRECT,
      })
    ).resolves.toEqual(REFUSED);
    const rows = await agentRows(t);
    expect(rows.grants).toEqual([]);
    // Only an unknown code leaves the real one waiting.
    expect(rows.codes).toHaveLength("code" in change ? 1 : 0);
  });
});

describe("auth/grant/exchange refresh", () => {
  it("replaces the refresh token at every use and renews the grant", async () => {
    const { clientId, learner, t } = await setUp();
    const first = await letAgentIn(t, learner.sessionId, clientId);
    assert(first.outcome === "issued", "Expected tokens.");
    vi.setSystemTime(NOW + Duration.toMillis(Duration.days(1)));
    const second = await t.mutation(api.auth.grant.refresh, {
      clientId,
      refreshToken: first.tokens.refresh_token,
    });
    expect(second).toMatchObject({ outcome: "issued" });
    if (second.outcome !== "issued") {
      return;
    }
    expect(second.tokens.refresh_token).not.toBe(first.tokens.refresh_token);
    await expect(agentRows(t)).resolves.toMatchObject({
      grants: [
        expect.objectContaining({
          refreshedAt: NOW + Duration.toMillis(Duration.days(1)),
        }),
      ],
    });
    // A spent refresh token holds no more.
    await expect(
      t.mutation(api.auth.grant.refresh, {
        clientId,
        refreshToken: first.tokens.refresh_token,
      })
    ).resolves.toEqual(REFUSED);
  });

  it("refuses an unknown token, and another agent's, and keeps the grant", async () => {
    const { clientId, learner, t } = await setUp();
    const issued = await letAgentIn(t, learner.sessionId, clientId);
    assert(issued.outcome === "issued", "Expected tokens.");
    const other = await registerTestAgent(t, "Other");
    for (const args of [
      { clientId, refreshToken: "not-a-token" },
      { clientId: other, refreshToken: issued.tokens.refresh_token },
    ]) {
      await expect(t.mutation(api.auth.grant.refresh, args)).resolves.toEqual(
        REFUSED
      );
    }
    await expect(agentRows(t)).resolves.toMatchObject({
      grants: [expect.objectContaining({ clientId })],
    });
  });

  it.each([
    ["unused for its lifetime", "expired"],
    ["of a deleted account", "deleted"],
  ] as const)("ends a grant %s", async (_case, cause) => {
    const { clientId, learner, t } = await setUp();
    const issued = await letAgentIn(t, learner.sessionId, clientId);
    assert(issued.outcome === "issued", "Expected tokens.");
    if (cause === "expired") {
      vi.setSystemTime(NOW + Duration.toMillis(GRANT_LIFETIME) + 1000);
    } else {
      await t.mutation((ctx) =>
        ctx.db.patch("users", learner.userId, { deletedAt: NOW })
      );
    }
    await expect(
      t.mutation(api.auth.grant.refresh, {
        clientId,
        refreshToken: issued.tokens.refresh_token,
      })
    ).resolves.toEqual(REFUSED);
    await expect(agentRows(t)).resolves.toMatchObject({ grants: [] });
  });
});
