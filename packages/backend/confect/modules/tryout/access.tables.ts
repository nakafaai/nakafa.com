import { GenericId } from "@confect/core";
import { Table } from "@confect/server";
import { tryoutProductSchema } from "@repo/backend/confect/modules/tryout/products";
import { Schema } from "effect";

export const tryoutAccessCampaignKindSchema = Schema.Literal(
  "competition",
  "access-pass"
);

export type TryoutAccessCampaignKind = Schema.Schema.Type<
  typeof tryoutAccessCampaignKindSchema
>;

export const tryoutAccessCampaignRedeemStatusSchema = Schema.Literal(
  "scheduled",
  "active",
  "ended"
);

export const tryoutAccessCampaignResultsStatusSchema = Schema.Literal(
  "pending",
  "finalized"
);

export const tryoutAccessGrantStatusSchema = Schema.Literal(
  "active",
  "expired"
);

export type TryoutAccessGrantStatus = Schema.Schema.Type<
  typeof tryoutAccessGrantStatusSchema
>;

export const userTryoutEntitlementSourceKindSchema = Schema.Literal(
  "competition",
  "access-pass"
);

export const tryoutAccessCampaignSchema = Schema.Struct({
  slug: Schema.String,
  name: Schema.String,
  campaignKind: tryoutAccessCampaignKindSchema,
  enabled: Schema.Boolean,
  redeemStatus: tryoutAccessCampaignRedeemStatusSchema,
  resultsStatus: tryoutAccessCampaignResultsStatusSchema,
  resultsFinalizedAt: Schema.Union(Schema.Number, Schema.Null),
  firstRedeemedAt: Schema.Union(Schema.Number, Schema.Null),
  startsAt: Schema.Number,
  endsAt: Schema.Number,
  grantDurationDays: Schema.optional(Schema.Number),
});

export const tryoutAccessCampaignProductSchema = Schema.Struct({
  campaignId: GenericId.GenericId("tryoutAccessCampaigns"),
  product: tryoutProductSchema,
  campaignKind: tryoutAccessCampaignKindSchema,
  startsAt: Schema.Number,
  endsAt: Schema.Number,
});

export const tryoutAccessLinkSchema = Schema.Struct({
  campaignId: GenericId.GenericId("tryoutAccessCampaigns"),
  code: Schema.String,
  label: Schema.String,
  enabled: Schema.Boolean,
});

export const tryoutAccessGrantSchema = Schema.Struct({
  campaignId: GenericId.GenericId("tryoutAccessCampaigns"),
  linkId: GenericId.GenericId("tryoutAccessLinks"),
  userId: GenericId.GenericId("users"),
  redeemedAt: Schema.Number,
  endsAt: Schema.Number,
  status: tryoutAccessGrantStatusSchema,
});

export const userTryoutEntitlementSchema = Schema.Struct({
  userId: GenericId.GenericId("users"),
  product: tryoutProductSchema,
  sourceKind: userTryoutEntitlementSourceKindSchema,
  accessCampaignId: Schema.optional(
    GenericId.GenericId("tryoutAccessCampaigns")
  ),
  accessGrantId: Schema.optional(GenericId.GenericId("tryoutAccessGrants")),
  startsAt: Schema.Number,
  endsAt: Schema.Number,
});

/** tryoutAccessCampaigns table definition. */
export const TryoutAccessCampaigns = Table.make(
  "tryoutAccessCampaigns",
  tryoutAccessCampaignSchema
)
  .index("by_slug", ["slug"])
  .index("by_campaignKind_and_startsAt", ["campaignKind", "startsAt"])
  .index("by_campaignKind_and_resultsStatus_and_endsAt", [
    "campaignKind",
    "resultsStatus",
    "endsAt",
  ])
  .index("by_redeemStatus_and_startsAt", ["redeemStatus", "startsAt"])
  .index("by_redeemStatus_and_endsAt", ["redeemStatus", "endsAt"]);

/** tryoutAccessCampaignProducts table definition. */
export const TryoutAccessCampaignProducts = Table.make(
  "tryoutAccessCampaignProducts",
  tryoutAccessCampaignProductSchema
)
  .index("by_campaignId", ["campaignId"])
  .index("by_product_and_campaignKind_and_startsAt", [
    "product",
    "campaignKind",
    "startsAt",
  ]);

/** tryoutAccessLinks table definition. */
export const TryoutAccessLinks = Table.make(
  "tryoutAccessLinks",
  tryoutAccessLinkSchema
)
  .index("by_code", ["code"])
  .index("by_campaignId", ["campaignId"]);

/** tryoutAccessGrants table definition. */
export const TryoutAccessGrants = Table.make(
  "tryoutAccessGrants",
  tryoutAccessGrantSchema
)
  .index("by_campaignId_and_redeemedAt", ["campaignId", "redeemedAt"])
  .index("by_userId_and_campaignId", ["userId", "campaignId"])
  .index("by_status_and_endsAt", ["status", "endsAt"]);

/** userTryoutEntitlements table definition. */
export const UserTryoutEntitlements = Table.make(
  "userTryoutEntitlements",
  userTryoutEntitlementSchema
)
  .index("by_accessGrantId", ["accessGrantId"])
  .index("by_sourceKind_and_endsAt", ["sourceKind", "endsAt"])
  .index("by_userId_and_product_and_sourceKind_and_endsAt", [
    "userId",
    "product",
    "sourceKind",
    "endsAt",
  ]);

export const tables = [
  TryoutAccessCampaigns,
  TryoutAccessCampaignProducts,
  TryoutAccessLinks,
  TryoutAccessGrants,
  UserTryoutEntitlements,
] as const;
