import posthogTest from "@posthog/convex/test";
import { getModelCreditCost } from "@repo/ai/config/model";
import { captureProductEvent } from "@repo/backend/convex/analytics/capture";
import { productAnalyticsEventValidator } from "@repo/backend/convex/analytics/events";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { validate } from "convex-helpers/validators";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 3, 2, 12, 0, 0);

describe("analytics/capture", () => {
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
        properties: {
          content_type: "article",
          is_new_view: true,
          locale: "id",
          slug: "articles/example",
        },
      })
    ).toBe(true);
    expect(
      validate(productAnalyticsEventValidator, {
        name: "exercise attempt started",
        properties: {
          mode: "practice",
          origin: "standalone",
          scope: "set",
          slug: "exercises/example",
          total_exercises: 10,
        },
      })
    ).toBe(true);
    expect(
      validate(productAnalyticsEventValidator, {
        name: "exercise attempt completed",
        properties: {
          answered_count: 10,
          correct_answers: 8,
          mode: "practice",
          origin: "standalone",
          score_percentage: 80,
          scope: "set",
          slug: "exercises/example",
          total_exercises: 10,
          total_time: 120,
        },
      })
    ).toBe(true);
    expect(
      validate(productAnalyticsEventValidator, {
        name: "tryout attempt started",
        properties: {
          attempt_number: 1,
          locale: "id",
          product: "snbt",
          score_status: "official",
          tryout_slug: "snbt-2026",
        },
      })
    ).toBe(true);
    expect(
      validate(productAnalyticsEventValidator, {
        name: "tryout attempt completed",
        properties: {
          attempt_number: 1,
          locale: "id",
          product: "snbt",
          raw_score_percentage: 75,
          score_status: "official",
          theta: 0.4,
          total_correct: 15,
          total_questions: 20,
          tryout_slug: "snbt-2026",
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
          credits: getModelCreditCost("nakafa-lite"),
          input_tokens: 10,
          model_id: "nakafa-lite",
          output_tokens: 20,
          total_tokens: 30,
        },
      })
    ).toBe(true);
    expect(
      validate(productAnalyticsEventValidator, {
        name: "checkout started",
        properties: {
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
          properties: {
            content_type: "article",
            is_new_view: true,
            locale: "id",
            slug: "articles/example",
          },
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
            properties: JSON.stringify({
              content_type: "article",
              is_new_view: true,
              locale: "id",
              slug: "articles/example",
            }),
            timestamp: NOW,
          }),
        ],
        name: expect.stringContaining("capture"),
      }),
    ]);
  });
});
