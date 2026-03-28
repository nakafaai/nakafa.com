import { tryoutProductValidator } from "@repo/backend/convex/tryouts/products";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

export const tryoutAccessCampaignRedeemStatusValidator = literals(
  "scheduled",
  "active",
  "ended"
);

export const tryoutAccessGrantStatusValidator = literals("active", "expired");

export const tryoutAccessCampaignValidator = v.object({
  slug: v.string(),
  name: v.string(),
  product: tryoutProductValidator,
  enabled: v.boolean(),
  redeemStatus: tryoutAccessCampaignRedeemStatusValidator,
  startsAt: v.number(),
  endsAt: v.number(),
  grantDurationDays: v.number(),
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
  product: tryoutProductValidator,
  redeemedAt: v.number(),
  endsAt: v.number(),
  status: tryoutAccessGrantStatusValidator,
});

const tables = {
  tryoutAccessCampaigns: defineTable(tryoutAccessCampaignValidator).index(
    "by_slug",
    ["slug"]
  ),

  tryoutAccessLinks: defineTable(tryoutAccessLinkValidator)
    .index("by_code", ["code"])
    .index("by_campaignId", ["campaignId"]),

  tryoutAccessGrants: defineTable(tryoutAccessGrantValidator)
    .index("by_userId_and_campaignId", ["userId", "campaignId"])
    .index("by_userId_and_product_and_status", ["userId", "product", "status"])
    .index("by_userId_and_product_and_endsAt", ["userId", "product", "endsAt"])
    .index("by_linkId", ["linkId"]),
};

export default tables;
