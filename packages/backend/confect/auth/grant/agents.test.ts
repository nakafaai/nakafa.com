import { assert, describe, expect, it } from "@effect/vitest";
import {
  createConvexTestWithAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api } from "@repo/backend/convex/_generated/api";
import {
  agentIdentity,
  letAgentIn,
  registerTestAgent,
} from "@repo/backend/test/agent/grant";

const NOW = Date.UTC(2026, 10, 13, 9, 0, 0);

describe("auth/grant/agents", () => {
  it("lists only the signed-in person's agents, newest first, and refuses a caller without a session", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const t = createConvexTestWithAuth();
    const [owner, stranger] = await t.mutation(async (ctx) => [
      await seedAuthenticatedUser(ctx, { now: NOW, suffix: "owner" }),
      await seedAuthenticatedUser(ctx, { now: NOW, suffix: "stranger" }),
    ]);
    const desktop = await registerTestAgent(t, "Desktop Agent");
    const phone = await registerTestAgent(t, "Phone Agent");
    await letAgentIn(t, owner.sessionId, desktop);
    vi.setSystemTime(NOW + 1000);
    await letAgentIn(t, owner.sessionId, phone);
    await letAgentIn(t, stranger.sessionId, desktop);
    const listed = await t
      .withIdentity({ subject: owner.sessionId })
      .query(api.auth.grant.list, {});
    expect(listed).toEqual([
      { grantId: expect.any(String), name: "Phone Agent", refreshedAt: NOW + 1000 },
      { grantId: expect.any(String), name: "Desktop Agent", refreshedAt: NOW },
    ]);
    await expect(t.query(api.auth.grant.list, {})).rejects.toMatchObject({
      data: { _tag: "SessionRequired" },
    });
  });

  it("ends one agent of the person at once and leaves another person's grant as it is", async () => {
    const t = createConvexTestWithAuth();
    const [owner, stranger] = await t.mutation(async (ctx) => [
      await seedAuthenticatedUser(ctx, { now: NOW, suffix: "owner" }),
      await seedAuthenticatedUser(ctx, { now: NOW, suffix: "stranger" }),
    ]);
    const clientId = await registerTestAgent(t);
    const mine = await letAgentIn(t, owner.sessionId, clientId);
    const theirs = await letAgentIn(t, stranger.sessionId, clientId);
    assert(mine.outcome === "issued" && theirs.outcome === "issued");
    const agent = agentIdentity(mine.tokens.access_token);
    const strangerAgent = agentIdentity(theirs.tokens.access_token);
    const [mineId, theirsId] = await t.query(async (ctx) => {
      const grantOf = async (userId: typeof owner.userId) => {
        const grant = await ctx.db
          .query("agentGrants")
          .withIndex("by_userId", (query) => query.eq("userId", userId))
          .unique();
        assert(grant !== null, "Expected the agent's grant.");
        return grant._id;
      };
      return [await grantOf(owner.userId), await grantOf(stranger.userId)];
    });
    const asOwner = t.withIdentity({ subject: owner.sessionId });
    // Another person's grant is left as it is.
    await expect(
      asOwner.mutation(api.auth.grant.revoke, { grantId: theirsId })
    ).resolves.toBeNull();
    await expect(
      asOwner.mutation(api.auth.grant.revoke, { grantId: mineId })
    ).resolves.toBeNull();
    await expect(
      t.withIdentity(agent).query(api.auth.queries.getCurrentUser, {})
    ).resolves.toBeNull();
    // A grant already gone answers the same.
    await expect(
      asOwner.mutation(api.auth.grant.revoke, { grantId: mineId })
    ).resolves.toBeNull();
    await expect(
      t.withIdentity(strangerAgent).query(api.auth.queries.getCurrentUser, {})
    ).resolves.toMatchObject({ appUser: { _id: stranger.userId } });
  });
});
