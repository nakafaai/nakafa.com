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
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "@repo/testing/effect";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { vi } from "vitest";

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

  it.live(
    "schedules current-consent product delivery with validated payload",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const scheduledJobs = yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
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
          })
        );

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
      })
  );

  it.live("drops a queued event when deletion starts before delivery", () =>
    Effect.gen(function* () {
      const capture = vi.fn(async () => undefined);
      const requestErasure = vi.fn(() => Effect.void);

      yield* deliverProductAnalyticsProgram({
        capture,
        isUserEligible: vi.fn(async () => false),
        requestErasure,
      });

      expect(capture).not.toHaveBeenCalled();
      expect(requestErasure).not.toHaveBeenCalled();
    })
  );

  it.live("keeps delivered analytics when the user remains active", () =>
    Effect.gen(function* () {
      const capture = vi.fn(async () => undefined);
      const requestErasure = vi.fn(() => Effect.void);

      yield* deliverProductAnalyticsProgram({
        capture,
        isUserEligible: vi.fn(async () => true),
        requestErasure,
      });

      expect(capture).toHaveBeenCalledOnce();
      expect(requestErasure).not.toHaveBeenCalled();
    })
  );

  it.live("durably erases analytics when withdrawal overlaps the send", () =>
    Effect.gen(function* () {
      const capture = vi.fn(async () => undefined);
      const requestErasure = vi.fn(() => Effect.void);
      const isUserActive = vi
        .fn<() => Promise<boolean>>()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      yield* deliverProductAnalyticsProgram({
        capture,
        isUserEligible: isUserActive,
        requestErasure,
      });

      expect(capture).toHaveBeenCalledOnce();
      expect(requestErasure).toHaveBeenCalledOnce();
    })
  );

  it.live("requests erasure after a failed send that overlaps withdrawal", () =>
    Effect.gen(function* () {
      const requestErasure = vi.fn(() => Effect.void);
      const isUserActive = vi
        .fn<() => Promise<boolean>>()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const failure = yield* deliverProductAnalyticsProgram({
        capture: vi.fn(() => Promise.reject(new Error("capture uncertain"))),
        isUserEligible: isUserActive,
        requestErasure,
      }).pipe(Effect.flip);

      expect(requestErasure).toHaveBeenCalledOnce();
      expect(failure).toMatchObject({
        _tag: "ProductAnalyticsCaptureError",
        message: "capture uncertain",
      });
    })
  );

  it.live(
    "requests erasure after a send when final eligibility is unknown",
    () =>
      Effect.gen(function* () {
        const requestErasure = vi.fn(() => Effect.void);
        const isUserActive = vi
          .fn<() => Promise<boolean>>()
          .mockResolvedValueOnce(true)
          .mockRejectedValueOnce(new Error("eligibility unavailable"));

        const failure = yield* deliverProductAnalyticsProgram({
          capture: vi.fn(async () => undefined),
          isUserEligible: isUserActive,
          requestErasure,
        }).pipe(Effect.flip);

        expect(requestErasure).toHaveBeenCalledOnce();
        expect(failure).toMatchObject({
          _tag: "ProductAnalyticsCaptureError",
          message: "eligibility unavailable",
        });
      })
  );

  it.live("admits an action event while its app user remains active", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const userId = yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
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
        })
      );

      const admitted = yield* Effect.promise(() =>
        t.mutation(internal.analytics.capture.captureActionProductEvent, {
          distinctId: userId,
          event: checkoutStartedEvent,
          timestamp: NOW,
        })
      );
      const scheduledJobs = yield* Effect.promise(() =>
        t.query((ctx) => ctx.db.system.query("_scheduled_functions").collect())
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
    })
  );

  it.live("drops an action event while account deletion is prepared", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const userId = yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
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
        })
      );

      const admitted = yield* Effect.promise(() =>
        t.mutation(internal.analytics.capture.captureActionProductEvent, {
          distinctId: userId,
          event: checkoutStartedEvent,
          timestamp: NOW,
        })
      );
      const scheduledJobs = yield* Effect.promise(() =>
        t.query((ctx) => ctx.db.system.query("_scheduled_functions").collect())
      );

      expect(admitted).toBe(false);
      expect(scheduledJobs).toEqual([]);
    })
  );

  it.live("drops an action event without current analytics consent", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const userId = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          ctx.db.insert("users", {
            authId: "removed-analytics-user-auth",
            credits: 10,
            creditsResetAt: NOW,
            email: "removed-analytics@example.com",
            name: "Removed Analytics User",
            plan: "free",
          })
        )
      );

      const admitted = yield* Effect.promise(() =>
        t.mutation(internal.analytics.capture.captureActionProductEvent, {
          distinctId: userId,
          event: checkoutStartedEvent,
        })
      );
      const scheduledJobs = yield* Effect.promise(() =>
        t.query((ctx) => ctx.db.system.query("_scheduled_functions").collect())
      );

      expect(admitted).toBe(false);
      expect(scheduledJobs).toEqual([]);
    })
  );

  it.live(
    "surfaces action event failures through the typed capture channel",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const userId = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            ctx.db.insert("users", {
              authId: "failing-analytics-user-auth",
              credits: 10,
              creditsResetAt: NOW,
              email: "failing-analytics@example.com",
              name: "Failing Analytics User",
              plan: "free",
            })
          )
        );

        yield* Effect.promise(() =>
          expect(
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
          })
        );
      })
  );
});
