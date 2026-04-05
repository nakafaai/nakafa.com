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
import { touchUserTryoutControl } from "@repo/backend/convex/tryouts/helpers/control";
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

interface ActiveTryoutEntitlements {
  accessPassEntitlement: Doc<"userTryoutEntitlements"> | null;
  competitionEntitlement: Doc<"userTryoutEntitlements"> | null;
  subscriptionEntitlement: Doc<"userTryoutEntitlements"> | null;
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

/** Loads the campaign and link documents for one public event code. */
export async function getTryoutAccessEventByCode(
  db: TryoutAccessDbReader,
  code: string
) {
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

  return {
    campaign,
    link,
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

/** Maps one paid Polar product to the matching tryout product, if any. */
function getTryoutProductFromPaidProductId(productId: string) {
  for (const product of tryoutProducts) {
    if (tryoutPaidProductIds[product] === productId) {
      return product;
    }
  }

  return null;
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

/** Loads every stored subscription entitlement row for one user. */
async function listUserSubscriptionEntitlements(
  db: TryoutAccessDbWriter,
  userId: Doc<"users">["_id"]
) {
  const entitlements: Doc<"userTryoutEntitlements">[] = [];

  for await (const entitlement of db
    .query("userTryoutEntitlements")
    .withIndex("by_userId_and_sourceKind_and_subscriptionId", (q) =>
      q.eq("userId", userId).eq("sourceKind", "subscription")
    )) {
    entitlements.push(entitlement);
  }

  return entitlements;
}

/** Buckets subscription entitlements by subscription ID and invalid leftovers. */
function groupSubscriptionEntitlements(
  entitlements: Doc<"userTryoutEntitlements">[]
) {
  const entitlementsBySubscriptionId = new Map<
    Doc<"subscriptions">["_id"],
    Doc<"userTryoutEntitlements">[]
  >();
  const invalidEntitlements: Doc<"userTryoutEntitlements">[] = [];

  for (const entitlement of entitlements) {
    if (!entitlement.subscriptionId) {
      invalidEntitlements.push(entitlement);
      continue;
    }

    const subscriptionEntitlements = entitlementsBySubscriptionId.get(
      entitlement.subscriptionId
    );

    if (subscriptionEntitlements) {
      subscriptionEntitlements.push(entitlement);
      continue;
    }

    entitlementsBySubscriptionId.set(entitlement.subscriptionId, [entitlement]);
  }

  return {
    entitlementsBySubscriptionId,
    invalidEntitlements,
  };
}

/** Synchronizes the active entitlement rows for one event grant. */
async function syncGrantEntitlements(
  db: TryoutAccessDbWriter,
  {
    campaign,
    endsAt,
    grant,
    status,
  }: {
    campaign: Doc<"tryoutAccessCampaigns"> | null;
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

  for (const product of campaign.products) {
    const productEntitlements = entitlementsByProduct.get(product) ?? [];
    const currentEntitlement = productEntitlements[0] ?? null;
    const nextEntitlement = {
      userId: grant.userId,
      product,
      sourceKind,
      accessCampaignId: grant.campaignId,
      accessGrantId: grant._id,
      subscriptionId: undefined,
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
      currentEntitlement.subscriptionId === nextEntitlement.subscriptionId &&
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
      subscriptionId: nextEntitlement.subscriptionId,
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
  await touchUserTryoutControl(db, {
    updatedAt: now,
    userId: grant.userId,
  });
  const status = getTryoutAccessGrantStatus(grant.endsAt, now);

  if (grant.status !== status) {
    await db.patch("tryoutAccessGrants", grant._id, {
      status,
    });
  }

  await syncGrantEntitlements(db, {
    campaign,
    endsAt: grant.endsAt,
    grant,
    status,
  });

  return status;
}

/** Synchronizes the active subscription entitlement rows for one user. */
export async function syncTryoutSubscriptionEntitlements(
  db: TryoutAccessDbWriter,
  {
    activeSubscriptions,
    now,
    userId,
  }: {
    activeSubscriptions: Pick<
      Doc<"subscriptions">,
      "_id" | "currentPeriodEnd" | "currentPeriodStart" | "productId"
    >[];
    now: number;
    userId: Doc<"users">["_id"];
  }
) {
  await touchUserTryoutControl(db, {
    updatedAt: now,
    userId,
  });
  const existingEntitlements = await listUserSubscriptionEntitlements(
    db,
    userId
  );
  const { entitlementsBySubscriptionId, invalidEntitlements } =
    groupSubscriptionEntitlements(existingEntitlements);

  for (const invalidEntitlement of invalidEntitlements) {
    await db.delete("userTryoutEntitlements", invalidEntitlement._id);
  }

  for (const subscription of activeSubscriptions) {
    const product = getTryoutProductFromPaidProductId(subscription.productId);

    if (!product) {
      continue;
    }

    const startsAt = parseTimestamp(
      subscription.currentPeriodStart,
      "currentPeriodStart"
    );

    if (startsAt === null) {
      continue;
    }

    const endsAt =
      parseTimestamp(subscription.currentPeriodEnd, "currentPeriodEnd") ??
      Number.MAX_SAFE_INTEGER;
    const subscriptionEntitlements =
      entitlementsBySubscriptionId.get(subscription._id) ?? [];
    const currentEntitlement = subscriptionEntitlements[0] ?? null;
    const nextEntitlement = {
      userId,
      product,
      sourceKind: "subscription" as const,
      accessCampaignId: undefined,
      accessGrantId: undefined,
      subscriptionId: subscription._id,
      startsAt,
      endsAt,
    };

    for (const duplicateEntitlement of subscriptionEntitlements.slice(1)) {
      await db.delete("userTryoutEntitlements", duplicateEntitlement._id);
    }

    if (!currentEntitlement) {
      await db.insert("userTryoutEntitlements", nextEntitlement);
      continue;
    }

    entitlementsBySubscriptionId.delete(subscription._id);

    if (
      currentEntitlement.userId === nextEntitlement.userId &&
      currentEntitlement.product === nextEntitlement.product &&
      currentEntitlement.sourceKind === nextEntitlement.sourceKind &&
      currentEntitlement.accessCampaignId ===
        nextEntitlement.accessCampaignId &&
      currentEntitlement.accessGrantId === nextEntitlement.accessGrantId &&
      currentEntitlement.subscriptionId === nextEntitlement.subscriptionId &&
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
      subscriptionId: nextEntitlement.subscriptionId,
      startsAt: nextEntitlement.startsAt,
      endsAt: nextEntitlement.endsAt,
    });
  }

  for (const staleEntitlements of entitlementsBySubscriptionId.values()) {
    for (const staleEntitlement of staleEntitlements) {
      await db.delete("userTryoutEntitlements", staleEntitlement._id);
    }
  }
}

/** Resolves the current active entitlement rows for one user and product. */
export async function resolveTryoutAccessEntitlements(
  db: TryoutAccessDbReader,
  {
    product,
    userId,
  }: {
    product: TryoutProduct;
    userId: Doc<"users">["_id"];
  }
): Promise<ActiveTryoutEntitlements> {
  const [
    competitionEntitlement,
    accessPassEntitlement,
    subscriptionEntitlement,
  ] = await Promise.all([
    db
      .query("userTryoutEntitlements")
      .withIndex("by_userId_and_product_and_sourceKind_and_endsAt", (q) =>
        q
          .eq("userId", userId)
          .eq("product", product)
          .eq("sourceKind", "competition")
      )
      .order("desc")
      .first(),
    db
      .query("userTryoutEntitlements")
      .withIndex("by_userId_and_product_and_sourceKind_and_endsAt", (q) =>
        q
          .eq("userId", userId)
          .eq("product", product)
          .eq("sourceKind", "access-pass")
      )
      .order("desc")
      .first(),
    db
      .query("userTryoutEntitlements")
      .withIndex("by_userId_and_product_and_sourceKind_and_endsAt", (q) =>
        q
          .eq("userId", userId)
          .eq("product", product)
          .eq("sourceKind", "subscription")
      )
      .order("desc")
      .first(),
  ]);

  return {
    accessPassEntitlement,
    competitionEntitlement,
    subscriptionEntitlement,
  };
}
