import { describe, expect, it } from "@effect/vitest";
import { GRANT_LIFETIME } from "@repo/backend/confect/auth/grant/token";
import {
  createConvexTestWithAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { internal } from "@repo/backend/convex/_generated/api";
import { REDIRECT } from "@repo/backend/test/agent/grant";
import { Array as Arr, Duration } from "effect";

const NOW = Date.UTC(2026, 10, 13, 9, 0, 0);
/** A grant's lifetime, which is also how long an idle registration stays. */
const MONTH = Duration.toMillis(GRANT_LIFETIME);

describe("auth/grant/sweep", () => {
  it("deletes stale codes, grants unused for their lifetime and idle registrations, and keeps the rest", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const t = createConvexTestWithAuth();
    const learner = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "sweep" })
    );
    const seeded = await t.mutation(async (ctx) => {
      const client = (name: string) =>
        ctx.db.insert("agentClients", { name, redirectUris: [REDIRECT] });
      const idle = await client("Idle");
      const held = await client("Held");
      const code = (clientId: typeof idle, expiresAt: number) =>
        ctx.db.insert("agentCodes", {
          clientId,
          codeChallenge: "challenge",
          codeHash: `code-${expiresAt}`,
          expiresAt,
          redirectUri: REDIRECT,
          userId: learner.userId,
        });
      const grant = (clientId: typeof idle, refreshedAt: number) =>
        ctx.db.insert("agentGrants", {
          clientId,
          refreshHash: `refresh-${refreshedAt}`,
          refreshedAt,
          userId: learner.userId,
        });
      return {
        freshCode: await code(held, NOW + MONTH * 2),
        freshGrant: await grant(held, NOW + MONTH * 2),
        held,
        idle,
        staleCode: await code(held, NOW + 1000),
        staleGrant: await grant(held, NOW),
      };
    });
    // A month and a day on, the idle registration is old enough to go.
    vi.setSystemTime(NOW + MONTH + Duration.toMillis(Duration.days(1)));
    await expect(t.mutation(internal.auth.grant.sweep, {})).resolves.toBeNull();
    const rows = await t.query(async (ctx) => ({
      clients: await ctx.db.query("agentClients").collect(),
      codes: await ctx.db.query("agentCodes").collect(),
      grants: await ctx.db.query("agentGrants").collect(),
    }));
    expect(Arr.map(rows.codes, (row) => row._id)).toEqual([seeded.freshCode]);
    expect(Arr.map(rows.grants, (row) => row._id)).toEqual([seeded.freshGrant]);
    expect(Arr.map(rows.clients, (row) => row._id)).toEqual([seeded.held]);
  });
});
