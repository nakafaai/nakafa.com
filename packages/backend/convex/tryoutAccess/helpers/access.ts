import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import type {
  tryoutAccessCampaignRedeemStatusValidator,
  tryoutAccessGrantStatusValidator,
} from "@repo/backend/convex/tryoutAccess/schema";
import {
  type TryoutProduct,
  tryoutProducts,
} from "@repo/backend/convex/tryouts/products";
import { products } from "@repo/backend/convex/utils/polar/products";
import type { Infer } from "convex/values";
import { ConvexError } from "convex/values";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const ACTIVE_ACCESS_SOURCE_PAGE_SIZE = 50;
const MAX_PRODUCT_GRANTS_PER_GRANT = tryoutProducts.length;

const tryoutPaidProductIds = {
  snbt: products.pro.id,
} satisfies Record<TryoutProduct, string>;

type TryoutAccessDbReader = MutationCtx["db"] | QueryCtx["db"];
type TryoutAccessDbWriter = MutationCtx["db"];
type TryoutAccessCampaignRedeemStatus = Infer<
  typeof tryoutAccessCampaignRedeemStatusValidator
>;
type TryoutAccessGrantStatus = Infer<typeof tryoutAccessGrantStatusValidator>;
interface TryoutEventSource {
  accessCampaignId: Doc<"tryoutAccessCampaigns">["_id"];
  accessCampaignKind: Doc<"tryoutAccessCampaigns">["campaignKind"];
  accessEndsAt: number;
  accessGrantId: Doc<"tryoutAccessProductGrants">["grantId"];
}

interface ActiveTryoutEventSources {
  accessPassEventSource: TryoutEventSource | null;
  competitionEventSources: TryoutEventSource[];
}

/** Normalizes a public event code so reads and writes share one canonical key. */
export function normalizeTryoutAccessCode(value: string) {
  return value.trim().toLowerCase();
}

/** Calculates the event grant end timestamp from the redeem time and duration. */
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

/** Returns the current access end timestamp for one redeemed grant. */
export function getTryoutAccessGrantEffectiveEndsAt({
  campaign,
  endsAt,
}: {
  campaign: Pick<Doc<"tryoutAccessCampaigns">, "campaignKind" | "endsAt">;
  endsAt: number;
}) {
  if (campaign.campaignKind !== "competition") {
    return endsAt;
  }

  return campaign.endsAt;
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

/** Synchronizes one summary grant and its product grants to the same status. */
export async function syncTryoutAccessGrantStatus(
  db: TryoutAccessDbWriter,
  grant: Pick<
    Doc<"tryoutAccessGrants">,
    "_id" | "campaignId" | "endsAt" | "status"
  >,
  now: number
) {
  const campaign = await db.get("tryoutAccessCampaigns", grant.campaignId);
  const effectiveEndsAt = campaign
    ? getTryoutAccessGrantEffectiveEndsAt({
        campaign,
        endsAt: grant.endsAt,
      })
    : grant.endsAt;
  const status = getTryoutAccessGrantStatus(effectiveEndsAt, now);
  const productGrants = await db
    .query("tryoutAccessProductGrants")
    .withIndex("by_grantId", (q) => q.eq("grantId", grant._id))
    .take(MAX_PRODUCT_GRANTS_PER_GRANT);
  const accessSources = await db
    .query("userTryoutAccessSources")
    .withIndex("by_accessGrantId", (q) => q.eq("accessGrantId", grant._id))
    .take(MAX_PRODUCT_GRANTS_PER_GRANT);
  const accessSourceByProduct = new Map(
    accessSources.map((accessSource) => [accessSource.product, accessSource])
  );

  if (grant.endsAt !== effectiveEndsAt || grant.status !== status) {
    await db.patch("tryoutAccessGrants", grant._id, {
      endsAt: effectiveEndsAt,
      status,
    });
  }

  for (const productGrant of productGrants) {
    const currentAccessSource = accessSourceByProduct.get(productGrant.product);

    if (
      productGrant.endsAt !== effectiveEndsAt ||
      productGrant.status !== status
    ) {
      await db.patch("tryoutAccessProductGrants", productGrant._id, {
        endsAt: effectiveEndsAt,
        status,
      });
    }

    if (!(campaign && status === "active")) {
      if (!currentAccessSource) {
        continue;
      }

      await db.delete("userTryoutAccessSources", currentAccessSource._id);
      accessSourceByProduct.delete(productGrant.product);
      continue;
    }

    const nextAccessSource = {
      userId: productGrant.userId,
      product: productGrant.product,
      accessCampaignId: grant.campaignId,
      accessCampaignKind: campaign.campaignKind,
      accessGrantId: grant._id,
      accessEndsAt: effectiveEndsAt,
    };

    if (!currentAccessSource) {
      await db.insert("userTryoutAccessSources", nextAccessSource);
      continue;
    }

    accessSourceByProduct.delete(productGrant.product);

    if (
      currentAccessSource.userId === nextAccessSource.userId &&
      currentAccessSource.product === nextAccessSource.product &&
      currentAccessSource.accessCampaignId ===
        nextAccessSource.accessCampaignId &&
      currentAccessSource.accessCampaignKind ===
        nextAccessSource.accessCampaignKind &&
      currentAccessSource.accessGrantId === nextAccessSource.accessGrantId &&
      currentAccessSource.accessEndsAt === nextAccessSource.accessEndsAt
    ) {
      continue;
    }

    await db.patch("userTryoutAccessSources", currentAccessSource._id, {
      userId: nextAccessSource.userId,
      product: nextAccessSource.product,
      accessCampaignId: nextAccessSource.accessCampaignId,
      accessCampaignKind: nextAccessSource.accessCampaignKind,
      accessGrantId: nextAccessSource.accessGrantId,
      accessEndsAt: nextAccessSource.accessEndsAt,
    });
  }

  for (const staleAccessSource of accessSourceByProduct.values()) {
    await db.delete("userTryoutAccessSources", staleAccessSource._id);
  }

  return status;
}

/**
 * Resolve the active event-based access sources for one user and product.
 *
 * This reads only the user-scoped active-access projection so the tryout start
 * mutation stays bounded even when campaign history grows.
 */
async function loadActiveTryoutEventSources(
  db: TryoutAccessDbReader,
  {
    product,
    userId,
  }: {
    product: TryoutProduct;
    userId: Doc<"users">["_id"];
  }
): Promise<ActiveTryoutEventSources> {
  const accessPassSource = await db
    .query("userTryoutAccessSources")
    .withIndex(
      "by_userId_and_product_and_accessCampaignKind_and_accessEndsAt",
      (q) =>
        q
          .eq("userId", userId)
          .eq("product", product)
          .eq("accessCampaignKind", "access-pass")
    )
    .order("desc")
    .first();
  const competitionEventSources: TryoutEventSource[] = [];
  let cursor: string | null = null;

  while (true) {
    const competitionPage = await db
      .query("userTryoutAccessSources")
      .withIndex(
        "by_userId_and_product_and_accessCampaignKind_and_accessEndsAt",
        (q) =>
          q
            .eq("userId", userId)
            .eq("product", product)
            .eq("accessCampaignKind", "competition")
      )
      .order("desc")
      .paginate({
        cursor,
        numItems: ACTIVE_ACCESS_SOURCE_PAGE_SIZE,
      });

    competitionEventSources.push(
      ...competitionPage.page.map((accessSource) => ({
        accessCampaignId: accessSource.accessCampaignId,
        accessCampaignKind: accessSource.accessCampaignKind,
        accessEndsAt: accessSource.accessEndsAt,
        accessGrantId: accessSource.accessGrantId,
      }))
    );

    if (competitionPage.isDone) {
      break;
    }

    cursor = competitionPage.continueCursor;
  }

  return {
    accessPassEventSource: accessPassSource
      ? {
          accessCampaignId: accessPassSource.accessCampaignId,
          accessCampaignKind: accessPassSource.accessCampaignKind,
          accessEndsAt: accessPassSource.accessEndsAt,
          accessGrantId: accessPassSource.accessGrantId,
        }
      : null,
    competitionEventSources,
  };
}

/** Checks whether the user currently has an active paid subscription for tryouts. */
async function hasActiveTryoutSubscription(
  db: TryoutAccessDbReader,
  {
    product,
    userId,
  }: {
    product: TryoutProduct;
    userId: Doc<"users">["_id"];
  }
) {
  const customer = await db
    .query("customers")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();

  if (!customer) {
    return false;
  }

  const subscription = await db
    .query("subscriptions")
    .withIndex("by_customerId_and_status_and_productId", (q) =>
      q
        .eq("customerId", customer.id)
        .eq("status", "active")
        .eq("productId", tryoutPaidProductIds[product])
    )
    .first();

  return subscription !== null;
}

/** Resolves whether a user can start a tryout using server time. */
export async function resolveTryoutAccessSources(
  db: TryoutAccessDbReader,
  {
    product,
    userId,
  }: {
    product: TryoutProduct;
    userId: Doc<"users">["_id"];
  }
): Promise<ActiveTryoutEventSources & { hasActiveSubscription: boolean }> {
  const [
    { accessPassEventSource, competitionEventSources },
    hasActiveSubscription,
  ] = await Promise.all([
    loadActiveTryoutEventSources(db, {
      product,
      userId,
    }),
    hasActiveTryoutSubscription(db, {
      product,
      userId,
    }),
  ]);

  return {
    accessPassEventSource,
    competitionEventSources,
    hasActiveSubscription,
  };
}
