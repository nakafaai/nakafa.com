import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  ANALYTICS_BROWSER_SIGNAL_MECHANISM,
  ANALYTICS_CONSENT_CATEGORY,
  ANALYTICS_CONSENT_MECHANISM,
  ANALYTICS_CONSENT_NOTICE_VERSION,
} from "@repo/analytics/consent";
import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  seedAnalyticsConsent,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import type { FunctionArgs } from "convex/server";

const NOW = Date.UTC(2026, 7, 20, 16, 0, 0);
const analyticsCategory = ANALYTICS_CONSENT_CATEGORY;

describe("consents/current", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("requires authentication to read", async () => {
    const t = createConvexTestWithBetterAuth();

    await expect(
      t.query(api.consents.current.get, {
        category: analyticsCategory,
      })
    ).rejects.toThrow();
  });

  it("returns the current notice and explicit account decision", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const seeded = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "consent-current-query",
      });
      await seedAnalyticsConsent(ctx, {
        decidedAt: NOW,
        userId: seeded.userId,
      });
      return seeded;
    });
    const authenticated = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    await expect(
      authenticated.query(api.consents.current.get, {
        category: analyticsCategory,
      })
    ).resolves.toEqual({
      currentNoticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
      decision: {
        category: analyticsCategory,
        decidedAt: NOW,
        granted: true,
        mechanism: ANALYTICS_CONSENT_MECHANISM,
        noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
      },
    });
  });

  it("returns no decision for an account that has not decided", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "consent-current-missing",
      })
    );

    await expect(
      t
        .withIdentity({
          sessionId: identity.sessionId,
          subject: identity.authUserId,
        })
        .query(api.consents.current.get, {
          category: analyticsCategory,
        })
    ).resolves.toEqual({
      currentNoticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
      decision: null,
    });
  });

  it("fails through the typed domain channel for duplicate state", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const seeded = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "consent-current-duplicate",
      });
      await seedAnalyticsConsent(ctx, {
        decidedAt: NOW,
        userId: seeded.userId,
      });
      await seedAnalyticsConsent(ctx, {
        decidedAt: NOW + 1,
        userId: seeded.userId,
      });
      return seeded;
    });

    await expect(
      t
        .withIdentity({
          sessionId: identity.sessionId,
          subject: identity.authUserId,
        })
        .query(api.consents.current.get, {
          category: analyticsCategory,
        })
    ).rejects.toMatchObject({
      data: {
        code: "CONSENT_PERSISTENCE_FAILED",
        message: "Unable to read or persist account consent.",
      },
    });
  });

  it("requires authentication to write", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "consent-current-unauthorized",
      })
    );

    await expect(
      t.mutation(api.consents.current.set, {
        decision: {
          category: analyticsCategory,
          granted: true,
          mechanism: ANALYTICS_CONSENT_MECHANISM,
          noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
        },
        expectedUserId: identity.userId,
      })
    ).rejects.toThrow();
  });

  it("rejects a decision queued by a different account", async () => {
    const t = createConvexTestWithBetterAuth();
    const original = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "consent-current-original",
      })
    );
    const current = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "consent-current-active",
      })
    );
    const authenticated = t.withIdentity({
      sessionId: current.sessionId,
      subject: current.authUserId,
    });

    await expect(
      authenticated.mutation(api.consents.current.set, {
        decision: {
          category: analyticsCategory,
          granted: true,
          mechanism: ANALYTICS_CONSENT_MECHANISM,
          noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
        },
        expectedUserId: original.userId,
      })
    ).rejects.toMatchObject({
      data: { code: "CONSENT_ACCOUNT_CHANGED" },
    });
    const stored = await t.query(async (ctx) =>
      ctx.db.query("accountConsentDecisions").take(1)
    );
    expect(stored).toEqual([]);
  });

  it("atomically records grant and withdrawal", async () => {
    vi.setSystemTime(new Date(NOW));
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "consent-current-write",
      })
    );
    const authenticated = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    const granted = await authenticated.mutation(api.consents.current.set, {
      decision: {
        category: analyticsCategory,
        granted: true,
        mechanism: ANALYTICS_CONSENT_MECHANISM,
        noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
      },
      expectedUserId: identity.userId,
    });
    vi.setSystemTime(new Date(NOW + 1000));
    const denied = await authenticated.mutation(api.consents.current.set, {
      decision: {
        category: analyticsCategory,
        granted: false,
        mechanism: ANALYTICS_BROWSER_SIGNAL_MECHANISM,
        noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
      },
      expectedUserId: identity.userId,
    });
    const stored = await t.query(async (ctx) => ({
      current: await ctx.db
        .query("accountConsents")
        .withIndex("by_userId_and_category", (query) =>
          query.eq("userId", identity.userId).eq("category", analyticsCategory)
        )
        .take(2),
      history: await ctx.db
        .query("accountConsentDecisions")
        .withIndex("by_userId_and_category_and_decidedAt", (query) =>
          query.eq("userId", identity.userId).eq("category", analyticsCategory)
        )
        .order("asc")
        .take(3),
    }));

    expect(granted).toMatchObject({
      decidedAt: NOW,
      granted: true,
      mechanism: ANALYTICS_CONSENT_MECHANISM,
    });
    expect(denied).toEqual({
      category: analyticsCategory,
      decidedAt: NOW + 1000,
      granted: false,
      mechanism: ANALYTICS_BROWSER_SIGNAL_MECHANISM,
      noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
    });
    expect(stored.current).toEqual([
      expect.objectContaining({
        ...denied,
        userId: identity.userId,
      }),
    ]);
    expect(stored.history).toEqual([
      expect.objectContaining({
        ...granted,
        userId: identity.userId,
      }),
      expect.objectContaining({
        ...denied,
        userId: identity.userId,
      }),
    ]);
  });

  it("returns an exact repeated decision without appending history", async () => {
    vi.setSystemTime(new Date(NOW));
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "consent-current-idempotent",
      })
    );
    const authenticated = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const input: FunctionArgs<typeof api.consents.current.set> = {
      decision: {
        category: analyticsCategory,
        granted: true,
        mechanism: ANALYTICS_CONSENT_MECHANISM,
        noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
      },
      expectedUserId: identity.userId,
    };

    const first = await authenticated.mutation(api.consents.current.set, input);
    vi.setSystemTime(new Date(NOW + 1000));
    const repeated = await authenticated.mutation(
      api.consents.current.set,
      input
    );
    const stored = await t.query(async (ctx) => ({
      current: await ctx.db
        .query("accountConsents")
        .withIndex("by_userId_and_category", (query) =>
          query.eq("userId", identity.userId).eq("category", analyticsCategory)
        )
        .take(2),
      history: await ctx.db
        .query("accountConsentDecisions")
        .withIndex("by_userId_and_category_and_decidedAt", (query) =>
          query.eq("userId", identity.userId).eq("category", analyticsCategory)
        )
        .take(2),
    }));

    expect(repeated).toEqual(first);
    expect(first.decidedAt).toBe(NOW);
    expect(stored.current).toHaveLength(1);
    expect(stored.history).toHaveLength(1);
  });
});
