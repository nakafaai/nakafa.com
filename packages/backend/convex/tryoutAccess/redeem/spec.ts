import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { type Infer, v } from "convex/values";
import { Schema } from "effect";

export const eventProductsRequiredCode = "EVENT_PRODUCTS_REQUIRED";
export const eventAccessReadFailedCode = "EVENT_ACCESS_READ_FAILED";
export const eventAccessWriteFailedCode = "EVENT_ACCESS_WRITE_FAILED";
export const invalidCampaignWindowCode = "INVALID_CAMPAIGN_WINDOW";
export const activeRedemptionKind = "active";
export const alreadyActiveRedemptionKind = "already-active";
export const usedRedemptionKind = "used";
export const disabledRedemptionKind = "disabled";
export const notStartedRedemptionKind = "not-started";
export const endedRedemptionKind = "ended";
export const notFoundRedemptionKind = "not-found";

const redeemEventAccessCodeValidator = v.string();

export const redeemEventAccessArgs = {
  code: redeemEventAccessCodeValidator,
};

export const redeemEventAccessArgsValidator = v.object(redeemEventAccessArgs);

export const redeemEventAccessResultValidator = v.union(
  v.object({
    kind: v.literal(activeRedemptionKind),
    endsAt: v.number(),
    name: v.string(),
  }),
  v.object({
    kind: v.literal(alreadyActiveRedemptionKind),
    endsAt: v.number(),
    name: v.string(),
  }),
  v.object({
    kind: v.literal(usedRedemptionKind),
    endsAt: v.number(),
    name: v.string(),
  }),
  v.object({
    kind: v.literal(disabledRedemptionKind),
    name: v.string(),
  }),
  v.object({
    kind: v.literal(notStartedRedemptionKind),
    name: v.string(),
  }),
  v.object({
    kind: v.literal(endedRedemptionKind),
    name: v.string(),
  }),
  v.object({
    kind: v.literal(notFoundRedemptionKind),
  })
);

export type RedeemEventAccessArgs = Infer<
  typeof redeemEventAccessArgsValidator
>;

export interface RedeemEventAccessInput extends RedeemEventAccessArgs {
  readonly now: number;
  readonly userId: Doc<"users">["_id"];
}

export type RedeemEventAccessResult = Infer<
  typeof redeemEventAccessResultValidator
>;

/** Raised when a redeemable campaign has no product relation rows. */
export class EventProductsRequiredError extends Schema.TaggedError<EventProductsRequiredError>()(
  "EventProductsRequiredError",
  {
    code: Schema.Literal(eventProductsRequiredCode),
    message: Schema.String,
  }
) {}

/** Raised when Convex read IO fails during redemption. */
export class EventAccessReadError extends Schema.TaggedError<EventAccessReadError>()(
  "EventAccessReadError",
  {
    code: Schema.Literal(eventAccessReadFailedCode),
    message: Schema.String,
  }
) {}

/** Raised when Convex write or scheduler IO fails during redemption. */
export class EventAccessWriteError extends Schema.TaggedError<EventAccessWriteError>()(
  "EventAccessWriteError",
  {
    code: Schema.Literal(eventAccessWriteFailedCode),
    message: Schema.String,
  }
) {}

/** Raised when the campaign cannot produce a valid grant window. */
export class InvalidCampaignWindowError extends Schema.TaggedError<InvalidCampaignWindowError>()(
  "InvalidCampaignWindowError",
  {
    code: Schema.Literal(invalidCampaignWindowCode),
    message: Schema.String,
  }
) {}
