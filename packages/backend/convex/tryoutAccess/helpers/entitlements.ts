import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { listTryoutAccessCampaignProducts } from "@repo/backend/convex/tryoutAccess/helpers/campaignProducts";
import { getTryoutAccessGrantStatus } from "@repo/backend/convex/tryoutAccess/helpers/status";
import type {
  TryoutAccessDbReader,
  TryoutAccessDbWriter,
} from "@repo/backend/convex/tryoutAccess/helpers/types";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";

/** Loads every entitlement row currently linked to one access grant. */
async function listGrantEntitlements(
  db: TryoutAccessDbWriter,
  grantId: Doc<"tryoutAccessGrants">["_id"]
) {
  const entitlements: Doc<"userTryoutEntitlements">[] = [];

  for await (const entitlement of db
    .query("userTryoutEntitlements")
    .withIndex("by_accessGrantId", (q) => q.eq("accessGrantId", grantId))) {
    entitlements.push(entitlement);
  }

  return entitlements;
}

/** Buckets entitlement rows by product so sync can keep one canonical row. */
function groupEntitlementsByProduct(
  entitlements: Doc<"userTryoutEntitlements">[]
) {
  const entitlementsByProduct = new Map<
    TryoutProduct,
    Doc<"userTryoutEntitlements">[]
  >();

  for (const entitlement of entitlements) {
    const productEntitlements = entitlementsByProduct.get(entitlement.product);

    if (productEntitlements) {
      productEntitlements.push(entitlement);
      continue;
    }

    entitlementsByProduct.set(entitlement.product, [entitlement]);
  }

  return entitlementsByProduct;
}

/** Synchronizes the active entitlement rows for one event grant. */
async function syncGrantEntitlements(
  db: TryoutAccessDbWriter,
  {
    campaign,
    campaignProducts,
    endsAt,
    grant,
    status,
  }: {
    campaign: Doc<"tryoutAccessCampaigns"> | null;
    campaignProducts: TryoutProduct[];
    endsAt: number;
    grant: Pick<
      Doc<"tryoutAccessGrants">,
      "_id" | "campaignId" | "endsAt" | "redeemedAt" | "status" | "userId"
    >;
    status: Doc<"tryoutAccessGrants">["status"];
  }
) {
  const entitlements = await listGrantEntitlements(db, grant._id);
  const entitlementsByProduct = groupEntitlementsByProduct(entitlements);

  if (!(campaign && status === "active")) {
    for (const entitlement of entitlements) {
      await db.delete("userTryoutEntitlements", entitlement._id);
    }

    return;
  }

  const sourceKind = campaign.campaignKind;

  for (const product of campaignProducts) {
    const productEntitlements = entitlementsByProduct.get(product) ?? [];
    const currentEntitlement = productEntitlements[0] ?? null;
    const nextEntitlement = {
      userId: grant.userId,
      product,
      sourceKind,
      accessCampaignId: grant.campaignId,
      accessGrantId: grant._id,
      startsAt: grant.redeemedAt,
      endsAt,
    };

    for (const duplicateEntitlement of productEntitlements.slice(1)) {
      await db.delete("userTryoutEntitlements", duplicateEntitlement._id);
    }

    if (!currentEntitlement) {
      await db.insert("userTryoutEntitlements", nextEntitlement);
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

    await db.patch("userTryoutEntitlements", currentEntitlement._id, {
      userId: nextEntitlement.userId,
      product: nextEntitlement.product,
      sourceKind: nextEntitlement.sourceKind,
      accessCampaignId: nextEntitlement.accessCampaignId,
      accessGrantId: nextEntitlement.accessGrantId,
      startsAt: nextEntitlement.startsAt,
      endsAt: nextEntitlement.endsAt,
    });
  }

  for (const staleEntitlements of entitlementsByProduct.values()) {
    for (const staleEntitlement of staleEntitlements) {
      await db.delete("userTryoutEntitlements", staleEntitlement._id);
    }
  }
}

/** Synchronizes the stored entitlement rows for one already-materialized grant. */
export async function syncTryoutAccessGrantEntitlements(
  db: TryoutAccessDbWriter,
  grant: Pick<
    Doc<"tryoutAccessGrants">,
    "_id" | "campaignId" | "endsAt" | "redeemedAt" | "status" | "userId"
  >,
  campaign: Doc<"tryoutAccessCampaigns"> | null
) {
  const campaignProducts = campaign
    ? await listTryoutAccessCampaignProducts(db, campaign._id)
    : [];

  await syncGrantEntitlements(db, {
    campaign,
    campaignProducts,
    endsAt: grant.endsAt,
    grant,
    status: grant.status,
  });
}

/** Synchronizes the stored grant row and its active entitlement rows. */
export async function syncTryoutAccessGrantStatus(
  db: TryoutAccessDbWriter,
  grant: Pick<
    Doc<"tryoutAccessGrants">,
    "_id" | "campaignId" | "endsAt" | "redeemedAt" | "status" | "userId"
  >,
  now: number
) {
  const status = getTryoutAccessGrantStatus(grant.endsAt, now);

  if (grant.status !== status) {
    await db.patch("tryoutAccessGrants", grant._id, {
      status,
    });
  }

  if (status === "expired") {
    await syncGrantEntitlements(db, {
      campaign: null,
      campaignProducts: [],
      endsAt: grant.endsAt,
      grant,
      status,
    });

    return status;
  }

  const campaign = await db.get("tryoutAccessCampaigns", grant.campaignId);
  const campaignProducts = campaign
    ? await listTryoutAccessCampaignProducts(db, campaign._id)
    : [];

  await syncGrantEntitlements(db, {
    campaign,
    campaignProducts,
    endsAt: grant.endsAt,
    grant,
    status,
  });

  return status;
}

/** Loads the latest active event entitlement row for one user, product, and source. */
async function getLatestActiveEventEntitlement(
  db: TryoutAccessDbReader,
  {
    now,
    product,
    sourceKind,
    userId,
  }: {
    now: number;
    product: TryoutProduct;
    sourceKind: Doc<"userTryoutEntitlements">["sourceKind"];
    userId: Doc<"users">["_id"];
  }
) {
  return await db
    .query("userTryoutEntitlements")
    .withIndex("by_userId_and_product_and_sourceKind_and_endsAt", (q) =>
      q
        .eq("userId", userId)
        .eq("product", product)
        .eq("sourceKind", sourceKind)
        .gt("endsAt", now)
    )
    .order("desc")
    .first();
}

/** Resolves the current active event entitlement rows for one user and product. */
export async function resolveActiveTryoutEventEntitlements(
  db: TryoutAccessDbReader,
  {
    now,
    product,
    userId,
  }: {
    now: number;
    product: TryoutProduct;
    userId: Doc<"users">["_id"];
  }
) {
  const [competitionEntitlement, accessPassEntitlement] = await Promise.all([
    getLatestActiveEventEntitlement(db, {
      now,
      product,
      sourceKind: "competition",
      userId,
    }),
    getLatestActiveEventEntitlement(db, {
      now,
      product,
      sourceKind: "access-pass",
      userId,
    }),
  ]);

  return {
    accessPassEntitlement,
    competitionEntitlement,
  };
}
