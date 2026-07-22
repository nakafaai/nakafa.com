import posthogTest from "@posthog/convex/test";
import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 6, 22, 9, 0, 0);

describe("tryouts/mutations/access", () => {
  it("records the authenticated paywall source", async () => {
    vi.setSystemTime(new Date(NOW));
    const t = createConvexTestWithBetterAuth();
    posthogTest.register(t);
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "tryout-paywall" })
    );
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    await expect(
      authed.mutation(api.tryouts.mutations.access.trackPaywallView, {
        source: "start-mutation",
      })
    ).resolves.toBeNull();

    const jobs = await t.query((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(jobs).toEqual([
      expect.objectContaining({
        args: [
          expect.objectContaining({
            event: "tryout paywall viewed",
            properties: JSON.stringify({ source: "start-mutation" }),
          }),
        ],
      }),
    ]);
  });

  it("rejects anonymous analytics writes", async () => {
    const t = createConvexTestWithBetterAuth();
    posthogTest.register(t);

    await expect(
      t.mutation(api.tryouts.mutations.access.trackPaywallView, {
        source: "access-query",
      })
    ).rejects.toThrow();
  });
});
