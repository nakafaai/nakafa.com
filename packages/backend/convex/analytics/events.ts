import {
  chatTypeValidator,
  messageGenerationErrorCodeValidator,
  modelIdValidator,
} from "@repo/backend/convex/chats/schema";
import {
  graphContentIdValidator,
  learningGraphIdentityValidator,
} from "@repo/backend/convex/contents/graph";
import {
  checkoutLocaleValidator,
  polarCheckoutLocaleValidator,
} from "@repo/backend/convex/customers/checkout/localization";
import {
  contentTypeValidator,
  localeValidator,
} from "@repo/backend/convex/lib/validators/contents";
import {
  tryoutRouteKeyValidator,
  tryoutScoreStatusValidator,
} from "@repo/backend/convex/tryouts/schema";
import { userPlanValidator } from "@repo/backend/convex/users/schema";
import type { Infer } from "convex/values";
import { v } from "convex/values";

const optionalNumber = v.optional(v.number());

/** Analytics event contract accepted by the product capture mutation. */
export const productAnalyticsEventValidator = v.union(
  v.object({
    name: v.literal("user signed up"),
    properties: v.object({
      plan: userPlanValidator,
    }),
  }),
  v.object({
    name: v.literal("content viewed"),
    properties: v.object({
      alignment_id: learningGraphIdentityValidator.fields.alignmentId,
      concept_id: learningGraphIdentityValidator.fields.conceptId,
      content_id: graphContentIdValidator,
      context_key: v.string(),
      content_type: contentTypeValidator,
      is_new_view: v.boolean(),
      learning_object_id:
        learningGraphIdentityValidator.fields.learningObjectId,
      lens_id: learningGraphIdentityValidator.fields.lensId,
      locale: localeValidator,
      route: v.string(),
    }),
  }),
  v.object({
    name: v.literal("tryout attempt started"),
    properties: v.object({
      attempt_number: v.number(),
      country_key: tryoutRouteKeyValidator,
      exam_key: tryoutRouteKeyValidator,
      locale: localeValidator,
      score_status: tryoutScoreStatusValidator,
      set_key: tryoutRouteKeyValidator,
    }),
  }),
  v.object({
    name: v.literal("tryout attempt completed"),
    properties: v.object({
      attempt_number: v.number(),
      country_key: tryoutRouteKeyValidator,
      exam_key: tryoutRouteKeyValidator,
      locale: localeValidator,
      raw_score_percentage: v.number(),
      score_status: tryoutScoreStatusValidator,
      set_key: tryoutRouteKeyValidator,
      theta: optionalNumber,
      total_correct: v.number(),
      total_questions: v.number(),
    }),
  }),
  v.object({
    name: v.literal("chat message sent"),
    properties: v.object({
      chat_type: chatTypeValidator,
      model_id: modelIdValidator,
    }),
  }),
  v.object({
    name: v.literal("chat response completed"),
    properties: v.object({
      chat_type: chatTypeValidator,
      credits: optionalNumber,
      input_tokens: optionalNumber,
      model_id: modelIdValidator,
      output_tokens: optionalNumber,
      total_tokens: optionalNumber,
    }),
  }),
  v.object({
    name: v.literal("chat response failed"),
    properties: v.object({
      chat_type: chatTypeValidator,
      error_code: messageGenerationErrorCodeValidator,
      model_id: modelIdValidator,
    }),
  }),
  v.object({
    name: v.literal("checkout started"),
    properties: v.object({
      checkout_locale: polarCheckoutLocaleValidator,
      customer_ip_available: v.boolean(),
      locale: checkoutLocaleValidator,
      product_count: v.number(),
      product_id: v.string(),
    }),
  }),
  v.object({
    name: v.literal("subscription started"),
    properties: v.object({
      product_id: v.string(),
      status: v.string(),
      subscription_id: v.string(),
    }),
  }),
  v.object({
    name: v.literal("subscription canceled"),
    properties: v.object({
      product_id: v.string(),
      status: v.string(),
      subscription_id: v.string(),
    }),
  }),
  v.object({
    name: v.literal("plan changed"),
    properties: v.object({
      new_plan: userPlanValidator,
      previous_plan: userPlanValidator,
      subscription_id: v.string(),
    }),
  })
);

export type ProductAnalyticsEvent = Infer<
  typeof productAnalyticsEventValidator
>;
