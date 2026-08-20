import { internal } from "@repo/backend/convex/_generated/api";
import {
  captureActionProductEventProgram,
  captureProductEvent,
  deliverProductAnalyticsProgram,
  ProductAnalyticsCaptureError,
} from "@repo/backend/convex/analytics/capture";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { seedAnalyticsConsent } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 3, 2, 12, 0, 0);
const contentViewProperties = {
  alignment_id: "alignment:id:articles:example",
  concept_id: "concept:id:articles:example",
  content_id: "asset:id:articles:example",
  context_key: "canonical",
  content_type: "article",
  is_new_view: true,
  learning_object_id: "lo:id:articles:example",
  lens_id: "lens:id:articles:example",
  locale: "id",
  route: "articles/example",
} as const;
const checkoutStartedEvent = {
  name: "checkout started",
  properties: {
    checkout_locale: "en",
    customer_ip_available: true,
    locale: "en",
    product_count: 1,
    product_id: "product-pro",
  },
} as const;

describe("analytics/capture", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules current-consent product delivery with validated payload", async () => {
    const t = convexTest(schema, convexModules);

    const scheduledJobs = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "analytics-user-auth",
        credits: 10,
        creditsResetAt: NOW,
        email: "analytics@example.com",
        name: "Analytics User",
        plan: "free",
      });
      await seedAnalyticsConsent(ctx, { decidedAt: NOW, userId });

      await runConvexProgram(
        captureProductEvent(ctx, {
          distinctId: userId,
          event: {
            name: "content viewed",
            properties: contentViewProperties,
          },
          timestamp: new Date(NOW),
        })
      );

      return await ctx.db.system.query("_scheduled_functions").collect();
    });

    expect(scheduledJobs).toEqual([
      expect.objectContaining({
        args: [
          expect.objectContaining({
            event: "content viewed",
            properties: JSON.stringify(contentViewProperties),
            timestamp: NOW,
          }),
        ],
        name: expect.stringContaining("deliverProductEvent"),
      }),
    ]);
  });

  it("drops a queued event when deletion starts before delivery", async () => {
    const capture = vi.fn(async () => undefined);
    const erase = vi.fn(() => Effect.void);

    await Effect.runPromise(
      deliverProductAnalyticsProgram({
        capture,
        erase,
        isUserEligible: vi.fn(async () => false),
      })
    );

    expect(capture).not.toHaveBeenCalled();
    expect(erase).not.toHaveBeenCalled();
  });

  it("keeps delivered analytics when the user remains active", async () => {
    const capture = vi.fn(async () => undefined);
    const erase = vi.fn(() => Effect.void);

    await Effect.runPromise(
      deliverProductAnalyticsProgram({
        capture,
        erase,
        isUserEligible: vi.fn(async () => true),
      })
    );

    expect(capture).toHaveBeenCalledOnce();
    expect(erase).not.toHaveBeenCalled();
  });

  it("re-erases analytics when deletion overlaps the external send", async () => {
    const capture = vi.fn(async () => undefined);
    const erase = vi.fn(() => Effect.void);
    const isUserActive = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    await Effect.runPromise(
      deliverProductAnalyticsProgram({
        capture,
        erase,
        isUserEligible: isUserActive,
      })
    );

    expect(capture).toHaveBeenCalledOnce();
    expect(erase).toHaveBeenCalledOnce();
  });

  it("re-erases after a failed send that overlaps deletion", async () => {
    const erase = vi.fn(() => Effect.void);
    const isUserActive = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const failure = await Effect.runPromise(
      deliverProductAnalyticsProgram({
        capture: vi.fn(() => Promise.reject(new Error("capture uncertain"))),
        erase,
        isUserEligible: isUserActive,
      }).pipe(Effect.flip)
    );

    expect(erase).toHaveBeenCalledOnce();
    expect(failure).toMatchObject({
      _tag: "ProductAnalyticsCaptureError",
      message: "capture uncertain",
    });
  });

  it("re-erases after a send when final eligibility is unknown", async () => {
    const erase = vi.fn(() => Effect.void);
    const isUserActive = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error("eligibility unavailable"));

    const failure = await Effect.runPromise(
      deliverProductAnalyticsProgram({
        capture: vi.fn(async () => undefined),
        erase,
        isUserEligible: isUserActive,
      }).pipe(Effect.flip)
    );

    expect(erase).toHaveBeenCalledOnce();
    expect(failure).toMatchObject({
      _tag: "ProductAnalyticsCaptureError",
      message: "eligibility unavailable",
    });
  });

  it("admits an action event while its app user remains active", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation(async (ctx) => {
      const insertedUserId = await ctx.db.insert("users", {
        authId: "active-analytics-user-auth",
        credits: 10,
        creditsResetAt: NOW,
        email: "active-analytics@example.com",
        name: "Active Analytics User",
        plan: "free",
      });
      await seedAnalyticsConsent(ctx, {
        decidedAt: NOW,
        userId: insertedUserId,
      });
      return insertedUserId;
    });

    const admitted = await t.mutation(
      internal.analytics.capture.captureActionProductEvent,
      {
        distinctId: userId,
        event: checkoutStartedEvent,
        timestamp: NOW,
      }
    );
    const scheduledJobs = await t.query((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );

    expect(admitted).toBe(true);
    expect(scheduledJobs).toEqual([
      expect.objectContaining({
        args: [
          expect.objectContaining({
            event: checkoutStartedEvent.name,
            properties: JSON.stringify(checkoutStartedEvent.properties),
            timestamp: NOW,
          }),
        ],
        name: expect.stringContaining("deliverProductEvent"),
      }),
    ]);
  });

  it("drops an action event while account deletion is prepared", async () => {
    const t = convexTest(schema, convexModules);

    const userId = await t.mutation(async (ctx) => {
      const insertedUserId = await ctx.db.insert("users", {
        authId: "deleting-analytics-user-auth",
        credits: 10,
        creditsResetAt: NOW,
        deletionPreparedAt: NOW,
        email: "deleting-analytics@example.com",
        name: "Deleting Analytics User",
        plan: "free",
      });
      await seedAnalyticsConsent(ctx, {
        decidedAt: NOW,
        userId: insertedUserId,
      });
      return insertedUserId;
    });

    const admitted = await t.mutation(
      internal.analytics.capture.captureActionProductEvent,
      {
        distinctId: userId,
        event: checkoutStartedEvent,
        timestamp: NOW,
      }
    );
    const scheduledJobs = await t.query((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );

    expect(admitted).toBe(false);
    expect(scheduledJobs).toEqual([]);
  });

  it("drops an action event without current analytics consent", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation((ctx) =>
      ctx.db.insert("users", {
        authId: "removed-analytics-user-auth",
        credits: 10,
        creditsResetAt: NOW,
        email: "removed-analytics@example.com",
        name: "Removed Analytics User",
        plan: "free",
      })
    );

    const admitted = await t.mutation(
      internal.analytics.capture.captureActionProductEvent,
      {
        distinctId: userId,
        event: checkoutStartedEvent,
      }
    );
    const scheduledJobs = await t.query((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );

    expect(admitted).toBe(false);
    expect(scheduledJobs).toEqual([]);
  });

  it("surfaces action event failures through the typed capture channel", async () => {
    const t = convexTest(schema, convexModules);
    const userId = await t.mutation((ctx) =>
      ctx.db.insert("users", {
        authId: "failing-analytics-user-auth",
        credits: 10,
        creditsResetAt: NOW,
        email: "failing-analytics@example.com",
        name: "Failing Analytics User",
        plan: "free",
      })
    );

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          captureActionProductEventProgram(
            ctx,
            {
              distinctId: userId,
              event: checkoutStartedEvent,
              timestamp: new Date(NOW),
            },
            {
              capture: () =>
                Effect.fail(
                  new ProductAnalyticsCaptureError({
                    code: "PRODUCT_ANALYTICS_CAPTURE_FAILED",
                    message: "PostHog unavailable",
                  })
                ),
              loadUser: () => ctx.db.get("users", userId),
            }
          )
        )
      )
    ).rejects.toMatchObject({
      data: {
        code: "PRODUCT_ANALYTICS_CAPTURE_FAILED",
        message: "PostHog unavailable",
      },
    });
  });
});
