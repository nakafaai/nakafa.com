import {
  chatTypeValidator,
  messageGenerationErrorCodeValidator,
  modelIdValidator,
} from "@repo/backend/confect/chats/schema";
import { appLocaleValidator } from "@repo/backend/confect/contentRelease/spec";
import {
  graphContentIdValidator,
  learningGraphIdentityValidator,
} from "@repo/backend/confect/contents/graph";
import {
  checkoutLocaleValidator,
  polarCheckoutLocaleValidator,
} from "@repo/backend/confect/customers/checkout/localization";
import {
  contentTypeValidator,
  localeValidator,
} from "@repo/backend/confect/lib/validators/contents";
import { NinaFailureReason } from "@repo/backend/confect/nina/turns.spec";
import { tryoutAttemptAccessSourceKindValidator } from "@repo/backend/confect/tryouts/access/source";
import { tryoutRouteKeyValidator } from "@repo/backend/confect/tryouts/route";
import { tryoutScoreStatusValidator } from "@repo/backend/confect/tryouts/score";
import { tryoutPaywallSourceValidator } from "@repo/backend/confect/tryouts/start/spec";
import { userPlanValidator } from "@repo/backend/confect/users/schema";
import { Schema } from "effect";

const optionalNumber = Schema.optionalKey(Schema.Finite);

/** Analytics event contract accepted by the product capture mutation. */
export const productAnalyticsEventValidator = Schema.Union([
  Schema.Struct({
    name: Schema.Literal("content viewed"),
    properties: Schema.Struct({
      alignment_id: learningGraphIdentityValidator.fields.alignmentId,
      concept_id: learningGraphIdentityValidator.fields.conceptId,
      content_id: graphContentIdValidator,
      context_key: Schema.String,
      content_type: contentTypeValidator,
      is_new_view: Schema.Boolean,
      learning_object_id:
        learningGraphIdentityValidator.fields.learningObjectId,
      lens_id: learningGraphIdentityValidator.fields.lensId,
      locale: localeValidator,
      route: Schema.String,
    }),
  }),
  Schema.Struct({
    name: Schema.Literal("tryout attempt started"),
    properties: Schema.Struct({
      access_source: tryoutAttemptAccessSourceKindValidator,
      attempt_number: Schema.Finite,
      country_key: tryoutRouteKeyValidator,
      exam_key: tryoutRouteKeyValidator,
      locale: appLocaleValidator,
      score_status: tryoutScoreStatusValidator,
      set_key: tryoutRouteKeyValidator,
      track_key: tryoutRouteKeyValidator,
    }),
  }),
  Schema.Struct({
    name: Schema.Literal("tryout attempt completed"),
    properties: Schema.Struct({
      attempt_number: Schema.Finite,
      country_key: tryoutRouteKeyValidator,
      exam_key: tryoutRouteKeyValidator,
      locale: appLocaleValidator,
      score_status: tryoutScoreStatusValidator,
      set_key: tryoutRouteKeyValidator,
      total_questions: Schema.Finite,
      track_key: tryoutRouteKeyValidator,
    }),
  }),
  Schema.Struct({
    name: Schema.Literal("tryout paywall viewed"),
    properties: Schema.Struct({
      source: tryoutPaywallSourceValidator,
    }),
  }),
  Schema.Struct({
    name: Schema.Literal("chat message sent"),
    properties: Schema.Struct({
      chat_type: chatTypeValidator,
      model_id: modelIdValidator,
    }),
  }),
  Schema.Struct({
    name: Schema.Literal("chat response completed"),
    properties: Schema.Struct({
      chat_type: chatTypeValidator,
      credits: optionalNumber,
      input_tokens: optionalNumber,
      model_id: modelIdValidator,
      output_tokens: optionalNumber,
      total_tokens: optionalNumber,
    }),
  }),
  Schema.Struct({
    name: Schema.Literal("chat response failed"),
    properties: Schema.Struct({
      chat_type: chatTypeValidator,
      error_code: Schema.Union([
        messageGenerationErrorCodeValidator,
        NinaFailureReason,
      ]),
      model_id: modelIdValidator,
    }),
  }),
  Schema.Struct({
    name: Schema.Literal("checkout started"),
    properties: Schema.Struct({
      checkout_locale: polarCheckoutLocaleValidator,
      customer_ip_available: Schema.Boolean,
      locale: checkoutLocaleValidator,
      product_count: Schema.Finite,
      product_id: Schema.String,
    }),
  }),
  Schema.Struct({
    name: Schema.Literal("subscription started"),
    properties: Schema.Struct({
      product_id: Schema.String,
      status: Schema.String,
    }),
  }),
  Schema.Struct({
    name: Schema.Literal("subscription canceled"),
    properties: Schema.Struct({
      product_id: Schema.String,
      status: Schema.String,
    }),
  }),
  Schema.Struct({
    name: Schema.Literal("plan changed"),
    properties: Schema.Struct({
      new_plan: userPlanValidator,
      previous_plan: userPlanValidator,
    }),
  }),
]);
export type ProductAnalyticsEvent = Schema.Schema.Type<
  typeof productAnalyticsEventValidator
>;
