import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import type {
  tryoutAccessCampaignRedeemStatusValidator,
  tryoutAccessGrantStatusValidator,
} from "@repo/backend/convex/tryoutAccess/schema";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { products } from "@repo/backend/convex/utils/polar/products";
import type { Infer } from "convex/values";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MAX_ACTIVE_TRYOUT_ACCESS_GRANTS = 20;

const tryoutPaidProductIds = {
  snbt: products.pro.id,
} satisfies Record<TryoutProduct, string>;

type TryoutAccessDbReader = MutationCtx["db"] | QueryCtx["db"];
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

/** Returns true when an event grant still allows tryout access. */
export function isTryoutAccessGrantActive(
  grant: Pick<Doc<"tryoutAccessGrants">, "endsAt">,
  now: number
) {
  return grant.endsAt > now;
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

/** Resolves whether a user can start a tryout from paid or event access. */
export async function hasTryoutAccess(
  db: TryoutAccessDbReader,
  {
    product,
    userId,
  }: {
    product: TryoutProduct;
    userId: Doc<"users">["_id"];
  }
) {
  const [customer, activeGrant] = await Promise.all([
    db
      .query("customers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique(),
    db
      .query("tryoutAccessGrants")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", userId).eq("status", "active")
      )
      .take(MAX_ACTIVE_TRYOUT_ACCESS_GRANTS),
  ]);

  if (customer) {
    const subscription = await db
      .query("subscriptions")
      .withIndex("by_customerId_and_status_and_productId", (q) =>
        q
          .eq("customerId", customer.id)
          .eq("status", "active")
          .eq("productId", tryoutPaidProductIds[product])
      )
      .first();

    if (subscription) {
      return true;
    }
  }

  for (const grant of activeGrant) {
    if (grant.products.includes(product)) {
      return true;
    }
  }

  return false;
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
  const [customer, activeGrant] = await Promise.all([
    db
      .query("customers")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique(),
    db
      .query("tryoutAccessGrants")
      .withIndex("by_userId_and_endsAt", (q) =>
        q.eq("userId", userId).gt("endsAt", now)
      )
      .order("desc")
      .take(MAX_ACTIVE_TRYOUT_ACCESS_GRANTS),
  ]);

  if (customer) {
    const subscription = await db
      .query("subscriptions")
      .withIndex("by_customerId_and_status_and_productId", (q) =>
        q
          .eq("customerId", customer.id)
          .eq("status", "active")
          .eq("productId", tryoutPaidProductIds[product])
      )
      .first();

    if (subscription) {
      return true;
    }
  }

  for (const grant of activeGrant) {
    if (grant.products.includes(product)) {
      return true;
    }
  }

  return false;
}
