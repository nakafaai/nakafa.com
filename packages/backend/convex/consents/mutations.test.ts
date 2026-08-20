import {
  ANALYTICS_BROWSER_SIGNAL_MECHANISM,
  ANALYTICS_CONSENT_CATEGORY,
  ANALYTICS_CONSENT_MECHANISM,
  ANALYTICS_CONSENT_NOTICE_VERSION,
} from "@repo/analytics/consent";
import { api } from "@repo/backend/convex/_generated/api";
import { consentWriteValidator } from "@repo/backend/convex/consents/schema";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { validate } from "convex-helpers/validators";
import { afterEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 7, 20, 16, 0, 0);
const analyticsCategory = ANALYTICS_CONSENT_CATEGORY;

describe("consents/mutations", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("requires an authenticated account", async () => {
    const t = createConvexTestWithBetterAuth();

    await expect(
      t.mutation(api.consents.mutations.setCurrent, {
        category: analyticsCategory,
        granted: true,
        mechanism: ANALYTICS_CONSENT_MECHANISM,
        noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
      })
    ).rejects.toThrow();
  });

  it("atomically records grant and withdrawal while replacing current state", async () => {
    vi.setSystemTime(new Date(NOW));
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "consent-write" })
    );
    const authenticated = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    const granted = await authenticated.mutation(
      api.consents.mutations.setCurrent,
      {
        category: analyticsCategory,
        granted: true,
        mechanism: ANALYTICS_CONSENT_MECHANISM,
        noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
      }
    );
    vi.setSystemTime(new Date(NOW + 1000));
    const denied = await authenticated.mutation(
      api.consents.mutations.setCurrent,
      {
        category: analyticsCategory,
        granted: false,
        mechanism: ANALYTICS_BROWSER_SIGNAL_MECHANISM,
        noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
      }
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
      seedAuthenticatedUser(ctx, { now: NOW, suffix: "consent-idempotent" })
    );
    const authenticated = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const input = {
      category: analyticsCategory,
      granted: true,
      mechanism: ANALYTICS_CONSENT_MECHANISM,
      noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
    } as const;

    const first = await authenticated.mutation(
      api.consents.mutations.setCurrent,
      input
    );
    vi.setSystemTime(new Date(NOW + 1000));
    const repeated = await authenticated.mutation(
      api.consents.mutations.setCurrent,
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

  it("rejects stale notice versions before the handler runs", () => {
    expect(
      validate(consentWriteValidator, {
        category: analyticsCategory,
        granted: true,
        mechanism: ANALYTICS_CONSENT_MECHANISM,
        noticeVersion: "privacy-stale",
      })
    ).toBe(false);
  });

  it("accepts only a denial from a browser privacy signal", () => {
    expect(
      validate(consentWriteValidator, {
        category: analyticsCategory,
        granted: false,
        mechanism: ANALYTICS_BROWSER_SIGNAL_MECHANISM,
        noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
      })
    ).toBe(true);
    expect(
      validate(consentWriteValidator, {
        category: analyticsCategory,
        granted: true,
        mechanism: ANALYTICS_BROWSER_SIGNAL_MECHANISM,
        noticeVersion: ANALYTICS_CONSENT_NOTICE_VERSION,
      })
    ).toBe(false);
  });
});
