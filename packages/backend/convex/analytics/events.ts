import {
  chatTypeValidator,
  messageGenerationErrorCodeValidator,
  modelIdValidator,
} from "@repo/backend/convex/chats/schema";
import {
  checkoutLocaleValidator,
  polarCheckoutLocaleValidator,
} from "@repo/backend/convex/customers/checkout/localization";
import {
  exerciseAttemptModeValidator,
  exerciseAttemptOriginValidator,
  exerciseAttemptScopeValidator,
} from "@repo/backend/convex/exercises/schema";
import {
  contentTypeValidator,
  localeValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { tryoutProductValidator } from "@repo/backend/convex/tryouts/products";
import {
  tryoutAccessKindValidator,
  tryoutScoreStatusValidator,
} from "@repo/backend/convex/tryouts/schema";
import { userPlanValidator } from "@repo/backend/convex/users/schema";
import type { Infer } from "convex/values";
import { v } from "convex/values";

const optionalNumber = v.optional(v.number());

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
      content_type: contentTypeValidator,
      is_new_view: v.boolean(),
      locale: localeValidator,
      slug: v.string(),
    }),
  }),
  v.object({
    name: v.literal("exercise attempt started"),
    properties: v.object({
      exercise_number: optionalNumber,
      mode: exerciseAttemptModeValidator,
      origin: exerciseAttemptOriginValidator,
      scope: exerciseAttemptScopeValidator,
      slug: v.string(),
      total_exercises: v.number(),
    }),
  }),
  v.object({
    name: v.literal("exercise attempt completed"),
    properties: v.object({
      answered_count: v.number(),
      correct_answers: v.number(),
      mode: exerciseAttemptModeValidator,
      origin: exerciseAttemptOriginValidator,
      score_percentage: v.number(),
      scope: exerciseAttemptScopeValidator,
      slug: v.string(),
      total_exercises: v.number(),
      total_time: v.number(),
    }),
  }),
  v.object({
    name: v.literal("tryout attempt started"),
    properties: v.object({
      access_kind: v.optional(tryoutAccessKindValidator),
      attempt_number: v.number(),
      locale: localeValidator,
      product: tryoutProductValidator,
      score_status: tryoutScoreStatusValidator,
      tryout_slug: v.string(),
    }),
  }),
  v.object({
    name: v.literal("tryout attempt completed"),
    properties: v.object({
      attempt_number: v.number(),
      locale: localeValidator,
      product: tryoutProductValidator,
      raw_score_percentage: v.number(),
      score_status: tryoutScoreStatusValidator,
      theta: v.number(),
      total_correct: v.number(),
      total_questions: v.number(),
      tryout_slug: v.string(),
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
