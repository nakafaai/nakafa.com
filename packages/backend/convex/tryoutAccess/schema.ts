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
  "finalizing",
  "finalized"
);

export const tryoutAccessGrantStatusValidator = literals("active", "expired");

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

export const tryoutAccessProductGrantValidator = v.object({
  campaignId: v.id("tryoutAccessCampaigns"),
  grantId: v.id("tryoutAccessGrants"),
  product: tryoutProductValidator,
  status: tryoutAccessGrantStatusValidator,
  userId: v.id("users"),
  endsAt: v.number(),
});

export const userTryoutAccessSourceValidator = v.object({
  userId: v.id("users"),
  product: tryoutProductValidator,
  accessCampaignId: v.id("tryoutAccessCampaigns"),
  accessCampaignKind: tryoutAccessCampaignKindValidator,
  accessGrantId: v.id("tryoutAccessGrants"),
  accessEndsAt: v.number(),
});

export const userTryoutCompetitionUsageValidator = v.object({
  userId: v.id("users"),
  tryoutId: v.id("tryouts"),
  accessCampaignId: v.id("tryoutAccessCampaigns"),
  tryoutAttemptId: v.id("tryoutAttempts"),
  usedAt: v.number(),
});

const tables = {
  tryoutAccessCampaigns: defineTable(tryoutAccessCampaignValidator)
    .index("by_slug", ["slug"])
    .index("by_campaignKind_and_resultsStatus_and_endsAt", [
      "campaignKind",
      "resultsStatus",
      "endsAt",
    ])
    .index("by_campaignKind_and_redeemStatus_and_endsAt", [
      "campaignKind",
      "redeemStatus",
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

  tryoutAccessProductGrants: defineTable(tryoutAccessProductGrantValidator)
    .index("by_grantId", ["grantId"])
    .index("by_userId_and_product_and_status", ["userId", "product", "status"])
    .index("by_userId_and_product_and_endsAt", ["userId", "product", "endsAt"]),

  userTryoutAccessSources: defineTable(userTryoutAccessSourceValidator)
    .index("by_accessGrantId", ["accessGrantId"])
    .index("by_accessCampaignId", ["accessCampaignId"])
    .index("by_userId_and_product_and_accessCampaignKind_and_accessEndsAt", [
      "userId",
      "product",
      "accessCampaignKind",
      "accessEndsAt",
    ]),

  userTryoutCompetitionUsages: defineTable(userTryoutCompetitionUsageValidator)
    .index("by_tryoutAttemptId", ["tryoutAttemptId"])
    .index("by_accessCampaignId", ["accessCampaignId"])
    .index("by_userId_and_tryoutId_and_accessCampaignId", [
      "userId",
      "tryoutId",
      "accessCampaignId",
    ]),
};

export default tables;
