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

const DAY_IN_MS = 24 * 60 * 60 * 1000;
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

/** Normalizes a public event code so reads and writes share one canonical key. */
export function normalizeTryoutAccessCode(value: string) {
  return value.trim().toLowerCase();
}

/** Calculates the event grant end timestamp from the redeem time and duration. */
export function getTryoutAccessGrantEndsAt(
  redeemedAt: number,
  grantDurationDays: number
) {
  return redeemedAt + grantDurationDays * DAY_IN_MS;
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
  grant: Pick<Doc<"tryoutAccessGrants">, "_id" | "endsAt" | "status">,
  now: number
) {
  const status = getTryoutAccessGrantStatus(grant.endsAt, now);
  const productGrants = await db
    .query("tryoutAccessProductGrants")
    .withIndex("by_grantId", (q) => q.eq("grantId", grant._id))
    .take(MAX_PRODUCT_GRANTS_PER_GRANT);

  if (grant.status !== status) {
    await db.patch("tryoutAccessGrants", grant._id, {
      status,
    });
  }

  for (const productGrant of productGrants) {
    if (productGrant.status === status) {
      continue;
    }

    await db.patch("tryoutAccessProductGrants", productGrant._id, {
      status,
    });
  }

  return status;
}

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
export async function hasTryoutAccessNow(
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
  if (await hasActiveTryoutSubscription(db, { product, userId })) {
    return true;
  }

  const activeProductGrant = await db
    .query("tryoutAccessProductGrants")
    .withIndex("by_userId_and_product_and_endsAt", (q) =>
      q.eq("userId", userId).eq("product", product).gt("endsAt", now)
    )
    .first();

  return activeProductGrant !== null;
}
