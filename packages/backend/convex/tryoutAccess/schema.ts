import { defineTable } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

export const tryoutAccessCampaignKindCompetition = "competition";
export const tryoutAccessCampaignKindAccessPass = "access-pass";
export const tryoutAccessCampaignRedeemStatusScheduled = "scheduled";
export const tryoutAccessCampaignRedeemStatusActive = "active";
export const tryoutAccessCampaignRedeemStatusEnded = "ended";
export const tryoutAccessCampaignResultsStatusPending = "pending";
export const tryoutAccessCampaignResultsStatusFinalized = "finalized";
export const tryoutAccessGrantStatusActive = "active";
export const tryoutAccessGrantStatusExpired = "expired";
export const tryoutEntitlementSourceKindCompetition = "competition";
export const tryoutEntitlementSourceKindAccessPass = "access-pass";
export const tryoutEntitlementSourceKindSubscription = "subscription";

export const tryoutAccessCampaignKindValidator = literals(
  tryoutAccessCampaignKindCompetition,
  tryoutAccessCampaignKindAccessPass
);
export const tryoutAccessCampaignRedeemStatusValidator = literals(
  tryoutAccessCampaignRedeemStatusScheduled,
  tryoutAccessCampaignRedeemStatusActive,
  tryoutAccessCampaignRedeemStatusEnded
);
export const tryoutAccessCampaignResultsStatusValidator = literals(
  tryoutAccessCampaignResultsStatusPending,
  tryoutAccessCampaignResultsStatusFinalized
);

export const tryoutAccessGrantStatusValidator = literals(
  tryoutAccessGrantStatusActive,
  tryoutAccessGrantStatusExpired
);

export const tryoutEntitlementSourceKindValidator = literals(
  tryoutEntitlementSourceKindCompetition,
  tryoutEntitlementSourceKindAccessPass,
  tryoutEntitlementSourceKindSubscription
);

const tryoutScopeFields = {
  countryKey: v.string(),
  examKey: v.string(),
};

const tryoutTrackScopeFields = {
  ...tryoutScopeFields,
  trackKey: v.string(),
};

const tryoutSetScopeFields = {
  ...tryoutTrackScopeFields,
  setKey: v.string(),
};

export const tryoutFreeAttemptClaimValidator = v.object({
  claimedAt: v.number(),
  countryKey: v.string(),
  examKey: v.string(),
  setKey: v.string(),
  trackKey: v.string(),
  userId: v.id("users"),
});

export const tryoutAccessCampaignValidator = v.object({
  slug: v.string(),
  name: v.string(),
  campaignKind: tryoutAccessCampaignKindValidator,
  enabled: v.boolean(),
  redeemStatus: tryoutAccessCampaignRedeemStatusValidator,
  resultsStatus: tryoutAccessCampaignResultsStatusValidator,
  resultsFinalizedAt: v.union(v.number(), v.null()),
  firstRedeemedAt: v.union(v.number(), v.null()),
  startsAt: v.number(),
  endsAt: v.number(),
  grantDurationDays: v.optional(v.number()),
});

export const tryoutAccessTargetValidator = v.union(
  v.object({
    campaignId: v.id("tryoutAccessCampaigns"),
    campaignKind: tryoutAccessCampaignKindValidator,
    endsAt: v.number(),
    startsAt: v.number(),
    ...tryoutScopeFields,
  }),
  v.object({
    campaignId: v.id("tryoutAccessCampaigns"),
    campaignKind: tryoutAccessCampaignKindValidator,
    endsAt: v.number(),
    startsAt: v.number(),
    ...tryoutTrackScopeFields,
  }),
  v.object({
    campaignId: v.id("tryoutAccessCampaigns"),
    campaignKind: tryoutAccessCampaignKindValidator,
    endsAt: v.number(),
    startsAt: v.number(),
    ...tryoutSetScopeFields,
  })
);

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

export const tryoutEntitlementValidator = v.union(
  v.object({
    accessCampaignId: v.optional(v.id("tryoutAccessCampaigns")),
    accessGrantId: v.optional(v.id("tryoutAccessGrants")),
    endsAt: v.number(),
    sourceKind: tryoutEntitlementSourceKindValidator,
    startsAt: v.number(),
    subscriptionId: v.optional(v.string()),
    userId: v.id("users"),
    ...tryoutScopeFields,
  }),
  v.object({
    accessCampaignId: v.optional(v.id("tryoutAccessCampaigns")),
    accessGrantId: v.optional(v.id("tryoutAccessGrants")),
    endsAt: v.number(),
    sourceKind: tryoutEntitlementSourceKindValidator,
    startsAt: v.number(),
    subscriptionId: v.optional(v.string()),
    userId: v.id("users"),
    ...tryoutTrackScopeFields,
  }),
  v.object({
    accessCampaignId: v.optional(v.id("tryoutAccessCampaigns")),
    accessGrantId: v.optional(v.id("tryoutAccessGrants")),
    endsAt: v.number(),
    sourceKind: tryoutEntitlementSourceKindValidator,
    startsAt: v.number(),
    subscriptionId: v.optional(v.string()),
    userId: v.id("users"),
    ...tryoutSetScopeFields,
  })
);

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

  tryoutAccessTargets: defineTable(tryoutAccessTargetValidator)
    .index("by_campaignId", ["campaignId"])
    .index("by_countryKey_and_examKey_and_trackKey_and_setKey_and_kind", [
      "countryKey",
      "examKey",
      "trackKey",
      "setKey",
      "campaignKind",
    ]),

  tryoutAccessLinks: defineTable(tryoutAccessLinkValidator)
    .index("by_code", ["code"])
    .index("by_campaignId", ["campaignId"]),

  tryoutAccessGrants: defineTable(tryoutAccessGrantValidator)
    .index("by_campaignId_and_redeemedAt", ["campaignId", "redeemedAt"])
    .index("by_userId_and_campaignId", ["userId", "campaignId"])
    .index("by_status_and_endsAt", ["status", "endsAt"]),

  tryoutFreeAttemptClaims: defineTable(tryoutFreeAttemptClaimValidator).index(
    "by_userId",
    ["userId"]
  ),

  tryoutEntitlements: defineTable(tryoutEntitlementValidator)
    .index("by_accessGrantId", ["accessGrantId"])
    .index("by_sourceKind_and_endsAt", ["sourceKind", "endsAt"])
    .index("by_user_tryout_scope_endsAt", [
      "userId",
      "countryKey",
      "examKey",
      "trackKey",
      "setKey",
      "endsAt",
    ])
    .index("by_user_tryout_scope_startsAt", [
      "userId",
      "countryKey",
      "examKey",
      "trackKey",
      "setKey",
      "startsAt",
    ])
    .index("by_user_subscription_scope", [
      "userId",
      "sourceKind",
      "subscriptionId",
      "countryKey",
      "examKey",
      "trackKey",
      "setKey",
    ]),
};

export default tables;
