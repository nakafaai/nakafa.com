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
import { loadOrCreateUserTryoutControl } from "@repo/backend/convex/tryouts/helpers/control";
import {
  type TryoutProduct,
  tryoutProducts,
} from "@repo/backend/convex/tryouts/products";
import { products } from "@repo/backend/convex/utils/polar/products";
import type { Infer } from "convex/values";
import { ConvexError } from "convex/values";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MAX_PRODUCTS_PER_ACCESS_SOURCE = tryoutProducts.length;
const MAX_ACTIVE_SUBSCRIPTIONS_PER_CUSTOMER = 10;

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

/** Resolves the effective end timestamp for one stored grant. */
export function getTryoutAccessGrantEffectiveEndsAt({
  campaign: _campaign,
  endsAt,
}: {
  campaign: Pick<Doc<"tryoutAccessCampaigns">, "campaignKind" | "endsAt">;
  endsAt: number;
}) {
  return endsAt;
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

/** Synchronizes the active entitlement rows for one event grant. */
async function syncGrantEntitlements(
  db: TryoutAccessDbWriter,
  {
    campaign,
    effectiveEndsAt,
    grant,
    status,
  }: {
    campaign: Doc<"tryoutAccessCampaigns"> | null;
    effectiveEndsAt: number;
    grant: Pick<
      Doc<"tryoutAccessGrants">,
      "_id" | "campaignId" | "endsAt" | "redeemedAt" | "status" | "userId"
    >;
    status: TryoutAccessGrantStatus;
  }
) {
  const entitlements = await db
    .query("userTryoutEntitlements")
    .withIndex("by_accessGrantId", (q) => q.eq("accessGrantId", grant._id))
    .take(MAX_PRODUCTS_PER_ACCESS_SOURCE);
  const entitlementsByProduct = new Map(
    entitlements.map((entitlement) => [entitlement.product, entitlement])
  );

  if (!(campaign && status === "active")) {
    for (const entitlement of entitlements) {
      await db.delete("userTryoutEntitlements", entitlement._id);
    }

    return;
  }

  const sourceKind: UserTryoutEntitlementSourceKind = campaign.campaignKind;

  for (const product of campaign.products) {
    const currentEntitlement = entitlementsByProduct.get(product);
    const nextEntitlement = {
      userId: grant.userId,
      product,
      sourceKind,
      accessCampaignId: grant.campaignId,
      accessGrantId: grant._id,
      subscriptionId: undefined,
      startsAt: grant.redeemedAt,
      endsAt: effectiveEndsAt,
    };

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

  for (const staleEntitlement of entitlementsByProduct.values()) {
    await db.delete("userTryoutEntitlements", staleEntitlement._id);
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
  const tryoutControl = await loadOrCreateUserTryoutControl(db, {
    updatedAt: now,
    userId: grant.userId,
  });

  if (tryoutControl) {
    await db.patch("userTryoutControls", tryoutControl._id, {
      updatedAt: now,
    });
  }
  const effectiveEndsAt = campaign
    ? getTryoutAccessGrantEffectiveEndsAt({
        campaign,
        endsAt: grant.endsAt,
      })
    : grant.endsAt;
  const status = getTryoutAccessGrantStatus(effectiveEndsAt, now);

  if (grant.endsAt !== effectiveEndsAt || grant.status !== status) {
    await db.patch("tryoutAccessGrants", grant._id, {
      endsAt: effectiveEndsAt,
      status,
    });
  }

  await syncGrantEntitlements(db, {
    campaign,
    effectiveEndsAt,
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
    userId,
  }: {
    activeSubscriptions: Pick<
      Doc<"subscriptions">,
      "_id" | "currentPeriodEnd" | "currentPeriodStart" | "productId"
    >[];
    userId: Doc<"users">["_id"];
  }
) {
  const now = Date.now();
  const tryoutControl = await loadOrCreateUserTryoutControl(db, {
    updatedAt: now,
    userId,
  });

  if (tryoutControl) {
    await db.patch("userTryoutControls", tryoutControl._id, {
      updatedAt: now,
    });
  }

  const existingEntitlements: Doc<"userTryoutEntitlements">[] = [];

  for (const product of tryoutProducts) {
    existingEntitlements.push(
      ...(await db
        .query("userTryoutEntitlements")
        .withIndex("by_userId_and_product_and_sourceKind_and_endsAt", (q) =>
          q
            .eq("userId", userId)
            .eq("product", product)
            .eq("sourceKind", "subscription")
        )
        .take(MAX_ACTIVE_SUBSCRIPTIONS_PER_CUSTOMER + 1))
    );
  }

  const existingEntitlementsBySubscriptionId = new Map(
    existingEntitlements.flatMap((entitlement) =>
      entitlement.subscriptionId
        ? [[entitlement.subscriptionId, entitlement]]
        : []
    )
  );

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
    const currentEntitlement = existingEntitlementsBySubscriptionId.get(
      subscription._id
    );
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

    if (!currentEntitlement) {
      await db.insert("userTryoutEntitlements", nextEntitlement);
      continue;
    }

    existingEntitlementsBySubscriptionId.delete(subscription._id);

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

  for (const staleEntitlement of existingEntitlementsBySubscriptionId.values()) {
    await db.delete("userTryoutEntitlements", staleEntitlement._id);
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
