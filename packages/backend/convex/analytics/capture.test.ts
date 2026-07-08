import posthogTest from "@posthog/convex/test";
import { chatResponseFailureCode } from "@repo/ai/config/generation";
import { getModelCreditCost, ModelIdSchema } from "@repo/ai/config/model";
import { captureProductEvent } from "@repo/backend/convex/analytics/capture";
import { productAnalyticsEventValidator } from "@repo/backend/convex/analytics/events";
import { posthog } from "@repo/backend/convex/posthog";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { validate } from "convex-helpers/validators";
import { convexTest } from "convex-test";
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

describe("analytics/capture", () => {
  const liteModel = ModelIdSchema.make("nakafa-lite");

  beforeEach(() => {
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the product analytics contract on approved event names", () => {
    expect(
      validate(productAnalyticsEventValidator, {
        name: "user signed up",
        properties: { plan: "free" },
      })
    ).toBe(true);
    expect(
      validate(productAnalyticsEventValidator, {
        name: "content viewed",
        properties: contentViewProperties,
      })
    ).toBe(true);
    expect(
      validate(productAnalyticsEventValidator, {
        name: "content viewed",
        properties: {
          content_type: "article",
          is_new_view: true,
          locale: "id",
          slug: "articles/example",
        },
      })
    ).toBe(false);
    expect(
      validate(productAnalyticsEventValidator, {
        name: "tryout attempt started",
        properties: {
          attempt_number: 1,
          country_key: "indonesia",
          exam_key: "snbt",
          locale: "id",
          score_status: "official",
          set_key: "set-1",
          track_key: "2027",
        },
      })
    ).toBe(true);
    expect(
      validate(productAnalyticsEventValidator, {
        name: "tryout attempt completed",
        properties: {
          attempt_number: 1,
          country_key: "indonesia",
          exam_key: "snbt",
          locale: "id",
          raw_score_percentage: 75,
          score_status: "official",
          set_key: "set-1",
          theta: 0.4,
          total_correct: 15,
          total_questions: 20,
          track_key: "2027",
        },
      })
    ).toBe(true);
    expect(
      validate(productAnalyticsEventValidator, {
        name: "chat message sent",
        properties: {
          chat_type: "study",
          model_id: "nakafa-lite",
        },
      })
    ).toBe(true);
    expect(
      validate(productAnalyticsEventValidator, {
        name: "chat response completed",
        properties: {
          chat_type: "study",
          credits: getModelCreditCost(liteModel),
          input_tokens: 10,
          model_id: "nakafa-lite",
          output_tokens: 20,
          total_tokens: 30,
        },
      })
    ).toBe(true);
    expect(
      validate(productAnalyticsEventValidator, {
        name: "chat response failed",
        properties: {
          chat_type: "study",
          error_code: chatResponseFailureCode,
          model_id: "nakafa-lite",
        },
      })
    ).toBe(true);
    expect(
      validate(productAnalyticsEventValidator, {
        name: "checkout started",
        properties: {
          checkout_locale: "en",
          customer_ip_available: true,
          locale: "id",
          product_count: 1,
          product_id: "product-pro",
        },
      })
    ).toBe(true);
    expect(
      validate(productAnalyticsEventValidator, {
        name: "subscription started",
        properties: {
          product_id: "product-pro",
          status: "active",
          subscription_id: "sub-pro",
        },
      })
    ).toBe(true);
    expect(
      validate(productAnalyticsEventValidator, {
        name: "subscription canceled",
        properties: {
          product_id: "product-pro",
          status: "canceled",
          subscription_id: "sub-pro",
        },
      })
    ).toBe(true);
    expect(
      validate(productAnalyticsEventValidator, {
        name: "plan changed",
        properties: {
          new_plan: "pro",
          previous_plan: "free",
          subscription_id: "sub-pro",
        },
      })
    ).toBe(true);
    expect(
      validate(productAnalyticsEventValidator, {
        name: "pageview",
        properties: {},
      })
    ).toBe(false);
  });

  it("schedules the PostHog component capture action with the product payload", async () => {
    const t = convexTest(schema, convexModules);
    posthogTest.register(t);

    const scheduledJobs = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "analytics-user-auth",
        credits: 10,
        creditsResetAt: NOW,
        email: "analytics@example.com",
        name: "Analytics User",
        plan: "free",
      });

      await captureProductEvent(ctx, {
        distinctId: userId,
        event: {
          name: "content viewed",
          properties: contentViewProperties,
        },
        timestamp: new Date(NOW),
      });

      return await ctx.db.system.query("_scheduled_functions").collect();
    });

    expect(scheduledJobs).toEqual([
      expect.objectContaining({
        args: [
          expect.objectContaining({
            disableGeoip: true,
            event: "content viewed",
            properties: JSON.stringify(contentViewProperties),
            timestamp: NOW,
          }),
        ],
        name: expect.stringContaining("capture"),
      }),
    ]);
  });

  it("keeps already scheduled component captures independent from the product event validator", async () => {
    const t = convexTest(schema, convexModules);
    posthogTest.register(t);

    const scheduledJobs = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "scheduled-analytics-user-auth",
        credits: 10,
        creditsResetAt: NOW,
        email: "scheduled-analytics@example.com",
        name: "Scheduled Analytics User",
        plan: "free",
      });

      await posthog.capture(ctx, {
        distinctId: userId,
        disableGeoip: true,
        event: "content viewed",
        properties: {
          content_type: "material-lesson",
          is_new_view: false,
          locale: "id",
          slug: "material/lesson/mathematics/example",
        },
        timestamp: new Date(NOW),
      });

      return await ctx.db.system.query("_scheduled_functions").collect();
    });

    expect(
      validate(productAnalyticsEventValidator, {
        name: "content viewed",
        properties: {
          content_type: "material-lesson",
          is_new_view: false,
          locale: "id",
          slug: "material/lesson/mathematics/example",
        },
      })
    ).toBe(false);
    expect(scheduledJobs).toEqual([
      expect.objectContaining({
        args: [
          expect.objectContaining({
            event: "content viewed",
            properties: JSON.stringify({
              content_type: "material-lesson",
              is_new_view: false,
              locale: "id",
              slug: "material/lesson/mathematics/example",
            }),
          }),
        ],
        name: expect.stringContaining("capture"),
      }),
    ]);
  });
});
