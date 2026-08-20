import {
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
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 7, 20, 15, 0, 0);
const analyticsCategory = ANALYTICS_CONSENT_CATEGORY;

describe("consents/queries", () => {
  it("requires an authenticated account", async () => {
    const t = createConvexTestWithBetterAuth();

    await expect(
      t.query(api.consents.queries.getCurrent, {
        category: analyticsCategory,
      })
    ).rejects.toThrow();
  });

  it("returns the current notice and explicit account decision", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const seeded = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "consent-query",
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
      authenticated.query(api.consents.queries.getCurrent, {
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
        suffix: "missing-consent",
      })
    );

    await expect(
      t
        .withIdentity({
          sessionId: identity.sessionId,
          subject: identity.authUserId,
        })
        .query(api.consents.queries.getCurrent, {
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
        suffix: "duplicate-consent",
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
        .query(api.consents.queries.getCurrent, {
          category: analyticsCategory,
        })
    ).rejects.toMatchObject({
      data: {
        code: "CONSENT_PERSISTENCE_FAILED",
        message: "Unable to read or persist account consent.",
      },
    });
  });
});
