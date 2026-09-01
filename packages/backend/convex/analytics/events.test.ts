import { describe, expect, it } from "@effect/vitest";
import { chatResponseFailureCode } from "@repo/ai/config/generation";
import { getModelCreditCost, ModelIdSchema } from "@repo/ai/config/model";
import { productAnalyticsEventValidator } from "@repo/backend/convex/analytics/events";
import { validate } from "convex-helpers/validators";

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
};
const checkoutStartedEvent = {
  name: "checkout started",
  properties: {
    checkout_locale: "en",
    customer_ip_available: true,
    locale: "en",
    product_count: 1,
    product_id: "product-pro",
  },
};

describe("analytics/events", () => {
  it("accepts only approved product event names and minimized properties", () => {
    const liteModel = ModelIdSchema.make("nakafa-lite");

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
          access_source: "free",
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
        name: "tryout paywall viewed",
        properties: { source: "access-query" },
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
          score_status: "official",
          set_key: "set-1",
          total_questions: 20,
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
    ).toBe(false);
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
    expect(validate(productAnalyticsEventValidator, checkoutStartedEvent)).toBe(
      true
    );
    expect(
      validate(productAnalyticsEventValidator, {
        name: "subscription started",
        properties: {
          product_id: "product-pro",
          status: "active",
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
    ).toBe(false);
    expect(
      validate(productAnalyticsEventValidator, {
        name: "subscription canceled",
        properties: {
          product_id: "product-pro",
          status: "canceled",
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
    ).toBe(false);
    expect(
      validate(productAnalyticsEventValidator, {
        name: "plan changed",
        properties: {
          new_plan: "pro",
          previous_plan: "free",
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
    ).toBe(false);
    expect(
      validate(productAnalyticsEventValidator, {
        name: "pageview",
        properties: {},
      })
    ).toBe(false);
  });
});
