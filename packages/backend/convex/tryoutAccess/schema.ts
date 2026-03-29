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
  products: v.array(tryoutProductValidator),
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
  products: v.array(tryoutProductValidator),
  redeemedAt: v.number(),
  endsAt: v.number(),
  status: tryoutAccessGrantStatusValidator,
});

const tables = {
  tryoutAccessCampaigns: defineTable(tryoutAccessCampaignValidator)
    .index("by_slug", ["slug"])
    .index("by_redeemStatus_and_startsAt", ["redeemStatus", "startsAt"])
    .index("by_redeemStatus_and_endsAt", ["redeemStatus", "endsAt"]),

  tryoutAccessLinks: defineTable(tryoutAccessLinkValidator)
    .index("by_code", ["code"])
    .index("by_campaignId", ["campaignId"]),

  tryoutAccessGrants: defineTable(tryoutAccessGrantValidator)
    .index("by_userId_and_campaignId", ["userId", "campaignId"])
    .index("by_userId_and_status", ["userId", "status"])
    .index("by_userId_and_endsAt", ["userId", "endsAt"])
    .index("by_status_and_endsAt", ["status", "endsAt"])
    .index("by_linkId", ["linkId"]),
};

export default tables;
