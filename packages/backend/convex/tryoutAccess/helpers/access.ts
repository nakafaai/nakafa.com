import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { products } from "@repo/backend/convex/utils/polar/products";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const tryoutPaidProductIds = {
  snbt: products.pro.id,
} satisfies Record<TryoutProduct, string>;

type TryoutAccessDbReader = MutationCtx["db"] | QueryCtx["db"];

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

/** Returns true when an event grant still allows tryout access. */
export function isTryoutAccessGrantActive(
  grant: Pick<Doc<"tryoutAccessGrants">, "endsAt">,
  now: number
) {
  return grant.endsAt > now;
}

/** Explains why a campaign link cannot currently be redeemed. */
export function getTryoutAccessUnavailableReason(
  eventAccess: {
    campaign: Pick<
      Doc<"tryoutAccessCampaigns">,
      "enabled" | "startsAt" | "endsAt"
    >;
    link: Pick<Doc<"tryoutAccessLinks">, "enabled">;
  },
  now: number
) {
  if (!(eventAccess.link.enabled && eventAccess.campaign.enabled)) {
    return "disabled" as const;
  }

  if (eventAccess.campaign.startsAt > now) {
    return "not-started" as const;
  }

  if (eventAccess.campaign.endsAt <= now) {
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
      .withIndex("by_userId_and_product_and_endsAt", (q) =>
        q.eq("userId", userId).eq("product", product).gt("endsAt", now)
      )
      .order("desc")
      .first(),
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

  return activeGrant !== null;
}
