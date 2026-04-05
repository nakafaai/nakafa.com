import { tryoutProductValidator } from "@repo/backend/convex/tryouts/products";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

export const tryoutAccessCampaignKindValidator = literals(
  "competition",
  "access-pass"
);
export const tryoutAccessCampaignRedeemStatusValidator = literals(
  "scheduled",
  "active",
  "ended"
);
export const tryoutAccessCampaignResultsStatusValidator = literals(
  "pending",
  "finalized"
);

export const tryoutAccessGrantStatusValidator = literals("active", "expired");

export const userTryoutEntitlementSourceKindValidator = literals(
  "competition",
  "access-pass",
  "subscription"
);

export const tryoutAccessCampaignValidator = v.object({
  slug: v.string(),
  name: v.string(),
  products: v.array(tryoutProductValidator),
  campaignKind: tryoutAccessCampaignKindValidator,
  enabled: v.boolean(),
  redeemStatus: tryoutAccessCampaignRedeemStatusValidator,
  resultsStatus: tryoutAccessCampaignResultsStatusValidator,
  resultsFinalizedAt: v.union(v.number(), v.null()),
  startsAt: v.number(),
  endsAt: v.number(),
  grantDurationDays: v.optional(v.number()),
});

export const tryoutAccessLinkValidator = v.object({
  campaignId: v.id("tryoutAccessCampaigns"),
  code: v.string(),
  label: v.string(),
  enabled: v.boolean(),
});

export const tryoutAccessGrantValidator = v.object({
  campaignId: v.id("tryoutAccessCampaigns"),
  linkId: v.id("tryoutAccessLinks"),
  userId: v.id("users"),
  redeemedAt: v.number(),
  endsAt: v.number(),
  status: tryoutAccessGrantStatusValidator,
});

export const userTryoutEntitlementValidator = v.object({
  userId: v.id("users"),
  product: tryoutProductValidator,
  sourceKind: userTryoutEntitlementSourceKindValidator,
  accessCampaignId: v.optional(v.id("tryoutAccessCampaigns")),
  accessGrantId: v.optional(v.id("tryoutAccessGrants")),
  subscriptionId: v.optional(v.id("subscriptions")),
  startsAt: v.number(),
  endsAt: v.number(),
});

const tables = {
  tryoutAccessCampaigns: defineTable(tryoutAccessCampaignValidator)
    .index("by_slug", ["slug"])
    .index("by_campaignKind_and_startsAt", ["campaignKind", "startsAt"])
    .index("by_campaignKind_and_resultsStatus_and_endsAt", [
      "campaignKind",
      "resultsStatus",
      "endsAt",
    ])
    .index("by_redeemStatus_and_startsAt", ["redeemStatus", "startsAt"])
    .index("by_redeemStatus_and_endsAt", ["redeemStatus", "endsAt"]),

  tryoutAccessLinks: defineTable(tryoutAccessLinkValidator)
    .index("by_code", ["code"])
    .index("by_campaignId", ["campaignId"]),

  tryoutAccessGrants: defineTable(tryoutAccessGrantValidator)
    .index("by_campaignId", ["campaignId"])
    .index("by_userId_and_campaignId", ["userId", "campaignId"])
    .index("by_status_and_endsAt", ["status", "endsAt"]),

  userTryoutEntitlements: defineTable(userTryoutEntitlementValidator)
    .index("by_accessGrantId", ["accessGrantId"])
    .index("by_subscriptionId", ["subscriptionId"])
    .index("by_userId_and_sourceKind_and_subscriptionId", [
      "userId",
      "sourceKind",
      "subscriptionId",
    ])
    .index("by_userId_and_product_and_sourceKind_and_endsAt", [
      "userId",
      "product",
      "sourceKind",
      "endsAt",
    ]),
};

export default tables;
