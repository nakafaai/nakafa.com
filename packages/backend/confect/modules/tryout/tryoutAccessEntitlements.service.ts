import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import type {
  ConvexMutationCtx,
  ConvexQueryCtx,
} from "@repo/backend/confect/modules/shared/convexContext";
import type { TryoutProduct } from "@repo/backend/confect/modules/tryout/products";
import {
  getTryoutAccessGrantStatus,
  listTryoutAccessCampaignProducts,
} from "@repo/backend/confect/modules/tryout/tryoutAccessShared.service";
import { Effect } from "effect";

/** Lists entitlement rows attached to one access grant. */
const listGrantEntitlements = Effect.fn("tryoutAccess.listGrantEntitlements")(
  function* (db: ConvexQueryCtx["db"], grantId: Id<"tryoutAccessGrants">) {
    return yield* Effect.promise(() =>
      db
        .query("userTryoutEntitlements")
        .withIndex("by_accessGrantId", (query) =>
          query.eq("accessGrantId", grantId)
        )
        .collect()
    );
  }
);

/** Groups entitlement rows by product. */
function groupEntitlementsByProduct(
  entitlements: readonly Doc<"userTryoutEntitlements">[]
) {
  const entitlementsByProduct = new Map<
    TryoutProduct,
    Doc<"userTryoutEntitlements">[]
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
const syncGrantEntitlements = Effect.fn("tryoutAccess.syncGrantEntitlements")(
  function* (
    db: ConvexMutationCtx["db"],
    args: {
      readonly campaign: Doc<"tryoutAccessCampaigns"> | null;
      readonly campaignProducts: readonly TryoutProduct[];
      readonly endsAt: number;
      readonly grant: Doc<"tryoutAccessGrants">;
      readonly status: "active" | "expired";
    }
  ) {
    const entitlements = yield* listGrantEntitlements(db, args.grant._id);
    const entitlementsByProduct = groupEntitlementsByProduct(entitlements);

    if (!(args.campaign && args.status === "active")) {
      for (const entitlement of entitlements) {
        yield* Effect.promise(() => db.delete(entitlement._id));
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
        yield* Effect.promise(() => db.delete(duplicateEntitlement._id));
      }

      if (!currentEntitlement) {
        yield* Effect.promise(() =>
          db.insert("userTryoutEntitlements", nextEntitlement)
        );
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

      yield* Effect.promise(() =>
        db.patch(currentEntitlement._id, nextEntitlement)
      );
    }

    for (const staleEntitlements of entitlementsByProduct.values()) {
      for (const staleEntitlement of staleEntitlements) {
        yield* Effect.promise(() => db.delete(staleEntitlement._id));
      }
    }

    return null;
  }
);

/** Synchronizes entitlement rows for a grant and optional campaign. */
export const syncTryoutAccessGrantEntitlements = Effect.fn(
  "tryoutAccess.syncGrantEntitlementsForCampaign"
)(function* (
  db: ConvexMutationCtx["db"],
  grant: Doc<"tryoutAccessGrants">,
  campaign: Doc<"tryoutAccessCampaigns"> | null
) {
  let campaignProducts: TryoutProduct[] = [];

  if (campaign) {
    campaignProducts = yield* listTryoutAccessCampaignProducts(
      db,
      campaign._id
    );
  }

  yield* syncGrantEntitlements(db, {
    campaign,
    campaignProducts,
    endsAt: grant.endsAt,
    grant,
    status: grant.status,
  });
});

/** Updates grant status and mirrors entitlement rows. */
export const syncTryoutAccessGrantStatus = Effect.fn(
  "tryoutAccess.syncGrantStatus"
)(function* (
  db: ConvexMutationCtx["db"],
  grant: Doc<"tryoutAccessGrants">,
  now: number
) {
  const status = getTryoutAccessGrantStatus(grant.endsAt, now);

  if (grant.status !== status) {
    yield* Effect.promise(() => db.patch(grant._id, { status }));
  }

  if (status === "expired") {
    yield* syncGrantEntitlements(db, {
      campaign: null,
      campaignProducts: [],
      endsAt: grant.endsAt,
      grant,
      status,
    });
    return status;
  }

  const campaign = yield* Effect.promise(() => db.get(grant.campaignId));
  let campaignProducts: TryoutProduct[] = [];

  if (campaign) {
    campaignProducts = yield* listTryoutAccessCampaignProducts(
      db,
      campaign._id
    );
  }

  yield* syncGrantEntitlements(db, {
    campaign,
    campaignProducts,
    endsAt: grant.endsAt,
    grant,
    status,
  });

  return status;
});

/** Resolves active event entitlements for a product and user. */
export const resolveActiveTryoutEventEntitlements = Effect.fn(
  "tryoutAccess.resolveActiveEntitlements"
)(function* (
  db: ConvexQueryCtx["db"],
  args: {
    readonly now: number;
    readonly product: TryoutProduct;
    readonly userId: Id<"users">;
  }
) {
  const competitionEntitlement = yield* Effect.promise(() =>
    db
      .query("userTryoutEntitlements")
      .withIndex("by_userId_and_product_and_sourceKind_and_endsAt", (query) =>
        query
          .eq("userId", args.userId)
          .eq("product", args.product)
          .eq("sourceKind", "competition")
          .gt("endsAt", args.now)
      )
      .order("desc")
      .first()
  );
  const accessPassEntitlement = yield* Effect.promise(() =>
    db
      .query("userTryoutEntitlements")
      .withIndex("by_userId_and_product_and_sourceKind_and_endsAt", (query) =>
        query
          .eq("userId", args.userId)
          .eq("product", args.product)
          .eq("sourceKind", "access-pass")
          .gt("endsAt", args.now)
      )
      .order("desc")
      .first()
  );

  return { accessPassEntitlement, competitionEntitlement };
});
