import { describe, expect, it } from "@effect/vitest";
import { productAnalyticsEventValidator } from "@repo/backend/confect/analytics/events";
import { chatResponseFailureCode } from "@repo/backend/confect/nina/config/generation";
import {
  getModelCreditCost,
  ModelIdSchema,
} from "@repo/backend/confect/nina/config/model";
import { Option, Schema } from "effect";

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
      Option.isSome(
        Schema.decodeUnknownOption(productAnalyticsEventValidator)(
          {
            name: "content viewed",
            properties: contentViewProperties,
          },
          {
            onExcessProperty: "error",
          }
        )
      )
    ).toBe(true);
    expect(
      Option.isSome(
        Schema.decodeUnknownOption(productAnalyticsEventValidator)(
          {
            name: "content viewed",
            properties: {
              content_type: "article",
              is_new_view: true,
              locale: "id",
              slug: "articles/example",
            },
          },
          {
            onExcessProperty: "error",
          }
        )
      )
    ).toBe(false);
    expect(
      Option.isSome(
        Schema.decodeOption(productAnalyticsEventValidator)(
          {
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
          },
          {
            onExcessProperty: "error",
          }
        )
      )
    ).toBe(true);
    expect(
      Option.isSome(
        Schema.decodeOption(productAnalyticsEventValidator)(
          {
            name: "tryout paywall viewed",
            properties: {
              source: "review",
            },
          },
          {
            onExcessProperty: "error",
          }
        )
      )
    ).toBe(true);
    expect(
      Option.isSome(
        Schema.decodeOption(productAnalyticsEventValidator)(
          {
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
          },
          {
            onExcessProperty: "error",
          }
        )
      )
    ).toBe(true);
    expect(
      Option.isSome(
        Schema.decodeUnknownOption(productAnalyticsEventValidator)(
          {
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
          },
          {
            onExcessProperty: "error",
          }
        )
      )
    ).toBe(false);
    expect(
      Option.isSome(
        Schema.decodeOption(productAnalyticsEventValidator)(
          {
            name: "chat message sent",
            properties: {
              chat_type: "study",
              model_id: "nakafa-lite",
            },
          },
          {
            onExcessProperty: "error",
          }
        )
      )
    ).toBe(true);
    expect(
      Option.isSome(
        Schema.decodeOption(productAnalyticsEventValidator)(
          {
            name: "chat response completed",
            properties: {
              chat_type: "study",
              credits: getModelCreditCost(liteModel),
              input_tokens: 10,
              model_id: "nakafa-lite",
              output_tokens: 20,
              total_tokens: 30,
            },
          },
          {
            onExcessProperty: "error",
          }
        )
      )
    ).toBe(true);
    expect(
      Option.isSome(
        Schema.decodeOption(productAnalyticsEventValidator)(
          {
            name: "chat response failed",
            properties: {
              chat_type: "study",
              error_code: chatResponseFailureCode,
              model_id: "nakafa-lite",
            },
          },
          {
            onExcessProperty: "error",
          }
        )
      )
    ).toBe(true);
    expect(
      Option.isSome(
        Schema.decodeUnknownOption(productAnalyticsEventValidator)(
          checkoutStartedEvent,
          {
            onExcessProperty: "error",
          }
        )
      )
    ).toBe(true);
    expect(
      Option.isSome(
        Schema.decodeOption(productAnalyticsEventValidator)(
          {
            name: "subscription started",
            properties: {
              product_id: "product-pro",
              status: "active",
            },
          },
          {
            onExcessProperty: "error",
          }
        )
      )
    ).toBe(true);
    expect(
      Option.isSome(
        Schema.decodeUnknownOption(productAnalyticsEventValidator)(
          {
            name: "subscription started",
            properties: {
              product_id: "product-pro",
              status: "active",
              subscription_id: "sub-pro",
            },
          },
          {
            onExcessProperty: "error",
          }
        )
      )
    ).toBe(false);
    expect(
      Option.isSome(
        Schema.decodeOption(productAnalyticsEventValidator)(
          {
            name: "subscription canceled",
            properties: {
              product_id: "product-pro",
              status: "canceled",
            },
          },
          {
            onExcessProperty: "error",
          }
        )
      )
    ).toBe(true);
    expect(
      Option.isSome(
        Schema.decodeUnknownOption(productAnalyticsEventValidator)(
          {
            name: "subscription canceled",
            properties: {
              product_id: "product-pro",
              status: "canceled",
              subscription_id: "sub-pro",
            },
          },
          {
            onExcessProperty: "error",
          }
        )
      )
    ).toBe(false);
    expect(
      Option.isSome(
        Schema.decodeOption(productAnalyticsEventValidator)(
          {
            name: "plan changed",
            properties: {
              new_plan: "pro",
              previous_plan: "free",
            },
          },
          {
            onExcessProperty: "error",
          }
        )
      )
    ).toBe(true);
    expect(
      Option.isSome(
        Schema.decodeUnknownOption(productAnalyticsEventValidator)(
          {
            name: "plan changed",
            properties: {
              new_plan: "pro",
              previous_plan: "free",
              subscription_id: "sub-pro",
            },
          },
          {
            onExcessProperty: "error",
          }
        )
      )
    ).toBe(false);
    expect(
      Option.isSome(
        Schema.decodeUnknownOption(productAnalyticsEventValidator)(
          {
            name: "pageview",
            properties: {},
          },
          {
            onExcessProperty: "error",
          }
        )
      )
    ).toBe(false);
  });
});
