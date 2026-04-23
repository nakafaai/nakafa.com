import { tryoutAccessCampaignKindValidator } from "@repo/backend/convex/tryoutAccess/schema";
import { tryoutProductValidator } from "@repo/backend/convex/tryouts/products";
import { ConvexError, type Infer, v } from "convex/values";

export const tryoutAccessCampaignInputValidator = v.object({
  slug: v.string(),
  name: v.string(),
  targetProducts: v.array(tryoutProductValidator),
  campaignKind: tryoutAccessCampaignKindValidator,
  enabled: v.boolean(),
  startsAt: v.number(),
  endsAt: v.number(),
  grantDurationDays: v.optional(v.number()),
});

export const tryoutAccessLinkInputValidator = v.object({
  code: v.string(),
  label: v.string(),
  enabled: v.boolean(),
});

export type TryoutAccessCampaignInput = Infer<
  typeof tryoutAccessCampaignInputValidator
>;
export type TryoutAccessLinkInput = Infer<
  typeof tryoutAccessLinkInputValidator
>;
export type TryoutAccessTargetProduct = Infer<typeof tryoutProductValidator>;

/** Rejects empty normalized event access codes before they are persisted. */
export function assertValidTryoutAccessCode(code: string) {
  if (code.length > 0) {
    return;
  }

  throw new ConvexError({
    code: "INVALID_EVENT_CODE",
    message: "Event access code cannot be empty.",
  });
}
