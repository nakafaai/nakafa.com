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

export function normalizeTryoutAccessCode(value: string) {
  return value.trim().toLowerCase();
}

export function getTryoutAccessGrantEndsAt(
  redeemedAt: number,
  grantDurationDays: number
) {
  return redeemedAt + grantDurationDays * DAY_IN_MS;
}

export function isTryoutAccessGrantActive(
  grant: Pick<Doc<"tryoutAccessGrants">, "endsAt">,
  now: number
) {
  return grant.endsAt > now;
}

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

export function getTryoutAccessGrantByCampaign(
  db: TryoutAccessDbReader,
  {
    campaignId,
    userId,
  }: Pick<Doc<"tryoutAccessGrants">, "campaignId" | "userId">
) {
  return db
    .query("tryoutAccessGrants")
    .withIndex("by_userId_and_campaignId", (q) =>
      q.eq("userId", userId).eq("campaignId", campaignId)
    )
    .unique();
}

export async function resolveTryoutAccessState(
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
      return {
        canStart: true,
        endsAt: null,
        source: "subscription" as const,
      };
    }
  }

  if (activeGrant) {
    return {
      canStart: true,
      endsAt: activeGrant.endsAt,
      source: "event" as const,
    };
  }

  return {
    canStart: false,
    endsAt: null,
    source: null,
  };
}
