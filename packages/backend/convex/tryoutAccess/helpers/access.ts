import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import type {
  tryoutAccessCampaignRedeemStatusValidator,
  tryoutAccessGrantStatusValidator,
  userTryoutEntitlementSourceKindValidator,
} from "@repo/backend/convex/tryoutAccess/schema";
import {
  type TryoutProduct,
  tryoutProducts,
} from "@repo/backend/convex/tryouts/products";
import { products } from "@repo/backend/convex/utils/polar/products";
import type { Infer } from "convex/values";
import { ConvexError } from "convex/values";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const tryoutPaidProductIds = {
  snbt: products.pro.id,
} satisfies Record<TryoutProduct, string>;

type TryoutAccessDbReader = MutationCtx["db"] | QueryCtx["db"];
type TryoutAccessDbWriter = MutationCtx["db"];
type TryoutAccessCampaignRedeemStatus = Infer<
  typeof tryoutAccessCampaignRedeemStatusValidator
>;
type TryoutAccessGrantStatus = Infer<typeof tryoutAccessGrantStatusValidator>;
type UserTryoutEntitlementSourceKind = Infer<
  typeof userTryoutEntitlementSourceKindValidator
>;

interface ActiveTryoutEventEntitlements {
  accessPassEntitlement: Doc<"userTryoutEntitlements"> | null;
  competitionEntitlement: Doc<"userTryoutEntitlements"> | null;
}

interface TryoutAccessEvent {
  campaign: Doc<"tryoutAccessCampaigns">;
  link: Doc<"tryoutAccessLinks">;
  products: TryoutProduct[];
}

/** Normalizes a public event code so reads and writes share one canonical key. */
export function normalizeTryoutAccessCode(value: string) {
  return value.trim().toLowerCase();
}

/** Calculates the persisted grant end timestamp for one redemption. */
export function getTryoutAccessGrantEndsAt({
  campaign,
  redeemedAt,
}: {
  campaign: Pick<
    Doc<"tryoutAccessCampaigns">,
    "campaignKind" | "endsAt" | "grantDurationDays"
  >;
  redeemedAt: number;
}) {
  if (campaign.campaignKind === "competition") {
    return campaign.endsAt;
  }

  if (campaign.grantDurationDays === undefined) {
    throw new ConvexError({
      code: "INVALID_CAMPAIGN_WINDOW",
      message: "Access-pass campaigns must define grantDurationDays.",
    });
  }

  return redeemedAt + campaign.grantDurationDays * DAY_IN_MS;
}

/** Resolves the current redeem status for one campaign time window. */
export function getTryoutAccessCampaignRedeemStatus(
  campaign: Pick<Doc<"tryoutAccessCampaigns">, "startsAt" | "endsAt">,
  now: number
): TryoutAccessCampaignRedeemStatus {
  if (campaign.startsAt > now) {
    return "scheduled";
  }

  if (campaign.endsAt <= now) {
    return "ended";
  }

  return "active";
}

/** Resolves the stored status for one grant end timestamp. */
export function getTryoutAccessGrantStatus(
  endsAt: number,
  now: number
): TryoutAccessGrantStatus {
  if (endsAt <= now) {
    return "expired";
  }

  return "active";
}

/** Explains why a campaign link cannot currently be redeemed. */
export function getTryoutAccessUnavailableReason(eventAccess: {
  campaign: Pick<Doc<"tryoutAccessCampaigns">, "enabled" | "redeemStatus">;
  link: Pick<Doc<"tryoutAccessLinks">, "enabled">;
}) {
  if (!(eventAccess.link.enabled && eventAccess.campaign.enabled)) {
    return "disabled" as const;
  }

  if (eventAccess.campaign.redeemStatus === "scheduled") {
    return "not-started" as const;
  }

  if (eventAccess.campaign.redeemStatus === "ended") {
    return "ended" as const;
  }

  return null;
}

/** Lists the explicit product membership rows for one access campaign. */
export async function listTryoutAccessCampaignProducts(
  db: TryoutAccessDbReader,
  campaignId: Doc<"tryoutAccessCampaigns">["_id"]
) {
  const rows = await db
    .query("tryoutAccessCampaignProducts")
    .withIndex("by_campaignId", (q) => q.eq("campaignId", campaignId))
    .collect();

  return rows.map((row) => row.product);
}

/** Loads the campaign, link, and scoped products for one public event code. */
export async function getTryoutAccessEventByCode(
  db: TryoutAccessDbReader,
  code: string
): Promise<TryoutAccessEvent | null> {
  const normalizedCode = normalizeTryoutAccessCode(code);

  if (normalizedCode.length === 0) {
    return null;
  }

  const link = await db
    .query("tryoutAccessLinks")
    .withIndex("by_code", (q) => q.eq("code", normalizedCode))
    .unique();

  if (!link) {
    return null;
  }

  const campaign = await db.get("tryoutAccessCampaigns", link.campaignId);

  if (!campaign) {
    return null;
  }

  const products = await listTryoutAccessCampaignProducts(db, campaign._id);

  return {
    campaign,
    link,
    products,
  };
}

/** Parses one ISO timestamp string into a millisecond value. */
function parseTimestamp(value: string | null, fieldName: string) {
  if (!value) {
    return null;
  }

  const parsedValue = Date.parse(value);

  if (!Number.isNaN(parsedValue)) {
    return parsedValue;
  }

  throw new ConvexError({
    code: "INVALID_SUBSCRIPTION_WINDOW",
    message: `Subscription ${fieldName} must be a valid ISO timestamp.`,
  });
}

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

/** Loads one active subscription whose access window never expires. */
async function getPerpetualActiveSubscriptionForProduct(
  db: TryoutAccessDbReader,
  {
    customerId,
    productId,
  }: {
    customerId: Doc<"subscriptions">["customerId"];
    productId: Doc<"subscriptions">["productId"];
  }
) {
  return await db
    .query("subscriptions")
    .withIndex(
      "by_customerId_and_status_and_productId_and_currentPeriodEnd",
      (q) =>
        q
          .eq("customerId", customerId)
          .eq("status", "active")
          .eq("productId", productId)
          .eq("currentPeriodEnd", null)
    )
    .first();
}

/** Loads the active subscription with the latest stored period end for one product. */
async function getLatestActiveSubscriptionForProduct(
  db: TryoutAccessDbReader,
  {
    customerId,
    productId,
  }: {
    customerId: Doc<"subscriptions">["customerId"];
    productId: Doc<"subscriptions">["productId"];
  }
) {
  const perpetualSubscription = await getPerpetualActiveSubscriptionForProduct(
    db,
    {
      customerId,
      productId,
    }
  );

  if (perpetualSubscription) {
    return perpetualSubscription;
  }

  return await db
    .query("subscriptions")
    .withIndex(
      "by_customerId_and_status_and_productId_and_currentPeriodEnd",
      (q) =>
        q
          .eq("customerId", customerId)
          .eq("status", "active")
          .eq("productId", productId)
    )
    .order("desc")
    .first();
}

/** Loads the canonical active tryout subscriptions that currently grant access. */
export async function listCanonicalActiveTryoutSubscriptions(
  db: TryoutAccessDbReader,
  {
    customerId,
  }: {
    customerId: Doc<"subscriptions">["customerId"];
  }
) {
  const activeSubscriptions = await Promise.all(
    tryoutProducts.map(
      async (product) =>
        await getLatestActiveSubscriptionForProduct(db, {
          customerId,
          productId: tryoutPaidProductIds[product],
        })
    )
  );

  return activeSubscriptions.filter(
    (subscription): subscription is Doc<"subscriptions"> =>
      subscription !== null
  );
}

/** Loads the active subscription that currently grants one user tryout access. */
export async function getActiveTryoutSubscriptionForUserProduct(
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
  const customer = await db
    .query("customers")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();

  if (!customer) {
    return null;
  }

  const subscription = await getLatestActiveSubscriptionForProduct(db, {
    customerId: customer.id,
    productId: tryoutPaidProductIds[product],
  });

  if (!subscription) {
    return null;
  }

  const startsAt = parseTimestamp(
    subscription.currentPeriodStart,
    "currentPeriodStart"
  );

  if (startsAt === null || startsAt > now) {
    return null;
  }

  const endsAt =
    parseTimestamp(subscription.currentPeriodEnd, "currentPeriodEnd") ??
    Number.MAX_SAFE_INTEGER;

  if (endsAt <= now) {
    return null;
  }

  return {
    endsAt,
    startsAt,
    subscriptionId: subscription._id,
  };
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
    status: TryoutAccessGrantStatus;
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

  const sourceKind: UserTryoutEntitlementSourceKind = campaign.campaignKind;

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
  const campaign = await db.get("tryoutAccessCampaigns", grant.campaignId);
  const campaignProducts = campaign
    ? await listTryoutAccessCampaignProducts(db, campaign._id)
    : [];
  const status = getTryoutAccessGrantStatus(grant.endsAt, now);

  if (grant.status !== status) {
    await db.patch("tryoutAccessGrants", grant._id, {
      status,
    });
  }

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
    sourceKind: UserTryoutEntitlementSourceKind;
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
): Promise<ActiveTryoutEventEntitlements> {
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
