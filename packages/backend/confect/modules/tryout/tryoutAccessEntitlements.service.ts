import type { Id } from "@repo/backend/confect/_generated/dataModel";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type {
  TryoutAccessCampaigns,
  TryoutAccessGrantStatus,
  TryoutAccessGrants,
  UserTryoutEntitlements,
} from "@repo/backend/confect/modules/tryout/access.tables";
import type { TryoutProduct } from "@repo/backend/confect/modules/tryout/products";
import {
  getTryoutAccessGrantStatus,
  listTryoutAccessCampaignProducts,
} from "@repo/backend/confect/modules/tryout/tryoutAccessShared.service";
import { Effect, Option } from "effect";

type UserTryoutEntitlement = typeof UserTryoutEntitlements.Doc.Type;
type TryoutAccessCampaign = typeof TryoutAccessCampaigns.Doc.Type;
type TryoutAccessGrant = typeof TryoutAccessGrants.Doc.Type;

/** Lists entitlement rows attached to one access grant. */
const listGrantEntitlements = Effect.fnUntraced(function* (
  grantId: Id<"tryoutAccessGrants">
) {
  const reader = yield* DatabaseReader;

  return yield* reader
    .table("userTryoutEntitlements")
    .index("by_accessGrantId", (query) => query.eq("accessGrantId", grantId))
    .collect();
});

/** Groups entitlement rows by product. */
function groupEntitlementsByProduct(
  entitlements: readonly UserTryoutEntitlement[]
) {
  const entitlementsByProduct = new Map<
    TryoutProduct,
    UserTryoutEntitlement[]
  >();

  for (const entitlement of entitlements) {
    const productEntitlements =
      entitlementsByProduct.get(entitlement.product) ?? [];
    productEntitlements.push(entitlement);
    entitlementsByProduct.set(entitlement.product, productEntitlements);
  }

  return entitlementsByProduct;
}

/** Synchronizes entitlement rows for one grant and campaign state. */
const syncGrantEntitlements = Effect.fnUntraced(function* (args: {
  readonly campaign: TryoutAccessCampaign | null;
  readonly campaignProducts: readonly TryoutProduct[];
  readonly endsAt: number;
  readonly grant: TryoutAccessGrant;
  readonly status: TryoutAccessGrantStatus;
}) {
  const writer = yield* DatabaseWriter;
  const entitlements = yield* listGrantEntitlements(args.grant._id);
  const entitlementsByProduct = groupEntitlementsByProduct(entitlements);

  if (!(args.campaign && args.status === "active")) {
    for (const entitlement of entitlements) {
      yield* writer.table("userTryoutEntitlements").delete(entitlement._id);
    }

    return null;
  }

  for (const product of args.campaignProducts) {
    const productEntitlements = entitlementsByProduct.get(product) ?? [];
    const currentEntitlement = productEntitlements[0] ?? null;
    const nextEntitlement = {
      accessCampaignId: args.grant.campaignId,
      accessGrantId: args.grant._id,
      endsAt: args.endsAt,
      product,
      sourceKind: args.campaign.campaignKind,
      startsAt: args.grant.redeemedAt,
      userId: args.grant.userId,
    };

    for (const duplicateEntitlement of productEntitlements.slice(1)) {
      yield* writer
        .table("userTryoutEntitlements")
        .delete(duplicateEntitlement._id);
    }

    if (!currentEntitlement) {
      yield* writer.table("userTryoutEntitlements").insert(nextEntitlement);
      continue;
    }

    entitlementsByProduct.delete(product);

    if (
      currentEntitlement.userId === nextEntitlement.userId &&
      currentEntitlement.product === nextEntitlement.product &&
      currentEntitlement.sourceKind === nextEntitlement.sourceKind &&
      currentEntitlement.accessCampaignId ===
        nextEntitlement.accessCampaignId &&
      currentEntitlement.accessGrantId === nextEntitlement.accessGrantId &&
      currentEntitlement.startsAt === nextEntitlement.startsAt &&
      currentEntitlement.endsAt === nextEntitlement.endsAt
    ) {
      continue;
    }

    yield* writer
      .table("userTryoutEntitlements")
      .patch(currentEntitlement._id, nextEntitlement);
  }

  for (const staleEntitlements of entitlementsByProduct.values()) {
    for (const staleEntitlement of staleEntitlements) {
      yield* writer
        .table("userTryoutEntitlements")
        .delete(staleEntitlement._id);
    }
  }

  return null;
});

/** Synchronizes entitlement rows for a grant and optional campaign. */
export const syncTryoutAccessGrantEntitlements = Effect.fnUntraced(function* (
  grant: TryoutAccessGrant,
  campaign: TryoutAccessCampaign | null
) {
  let campaignProducts: TryoutProduct[] = [];

  if (campaign) {
    campaignProducts = yield* listTryoutAccessCampaignProducts(campaign._id);
  }

  yield* syncGrantEntitlements({
    campaign,
    campaignProducts,
    endsAt: grant.endsAt,
    grant,
    status: grant.status,
  });
});

/** Updates grant status and mirrors entitlement rows. */
export const syncTryoutAccessGrantStatus = Effect.fnUntraced(function* (
  grant: TryoutAccessGrant,
  now: number
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const status = getTryoutAccessGrantStatus(grant.endsAt, now);

  if (grant.status !== status) {
    yield* writer.table("tryoutAccessGrants").patch(grant._id, { status });
  }

  if (status === "expired") {
    yield* syncGrantEntitlements({
      campaign: null,
      campaignProducts: [],
      endsAt: grant.endsAt,
      grant,
      status,
    });
    return status;
  }

  const campaign = yield* reader
    .table("tryoutAccessCampaigns")
    .get(grant.campaignId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));
  let campaignProducts: TryoutProduct[] = [];

  if (campaign) {
    campaignProducts = yield* listTryoutAccessCampaignProducts(campaign._id);
  }

  yield* syncGrantEntitlements({
    campaign,
    campaignProducts,
    endsAt: grant.endsAt,
    grant,
    status,
  });

  return status;
});

/** Resolves active event entitlements for a product and user. */
export const resolveActiveTryoutEventEntitlements = Effect.fnUntraced(
  function* (args: {
    readonly now: number;
    readonly product: TryoutProduct;
    readonly userId: Id<"users">;
  }) {
    const reader = yield* DatabaseReader;
    const competitionEntitlementOption = yield* reader
      .table("userTryoutEntitlements")
      .index(
        "by_userId_and_product_and_sourceKind_and_endsAt",
        (query) =>
          query
            .eq("userId", args.userId)
            .eq("product", args.product)
            .eq("sourceKind", "competition")
            .gt("endsAt", args.now),
        "desc"
      )
      .first();
    const accessPassEntitlementOption = yield* reader
      .table("userTryoutEntitlements")
      .index(
        "by_userId_and_product_and_sourceKind_and_endsAt",
        (query) =>
          query
            .eq("userId", args.userId)
            .eq("product", args.product)
            .eq("sourceKind", "access-pass")
            .gt("endsAt", args.now),
        "desc"
      )
      .first();
    const accessPassEntitlement = Option.getOrNull(accessPassEntitlementOption);
    const competitionEntitlement = Option.getOrNull(
      competitionEntitlementOption
    );

    return { accessPassEntitlement, competitionEntitlement };
  }
);
