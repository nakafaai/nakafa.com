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
import { getAll } from "convex-helpers/server/relationships";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const ACTIVE_PRODUCT_GRANT_PAGE_SIZE = 50;
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

  if (grant.endsAt !== effectiveEndsAt || grant.status !== status) {
    await db.patch("tryoutAccessGrants", grant._id, {
      endsAt: effectiveEndsAt,
      status,
    });
  }

  for (const productGrant of productGrants) {
    if (
      productGrant.endsAt === effectiveEndsAt &&
      productGrant.status === status
    ) {
      continue;
    }

    await db.patch("tryoutAccessProductGrants", productGrant._id, {
      endsAt: effectiveEndsAt,
      status,
    });
  }

  return status;
}

async function loadActiveTryoutEventSources(
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
): Promise<ActiveTryoutEventSources> {
  let accessPassEventSource: TryoutEventSource | null = null;
  const competitionEventSources: TryoutEventSource[] = [];

  async function readProductGrantStatusPage(status: "active" | "expired") {
    let cursor: string | null = null;

    while (true) {
      const productGrantPage = await db
        .query("tryoutAccessProductGrants")
        .withIndex("by_userId_and_product_and_status", (q) =>
          q.eq("userId", userId).eq("product", product).eq("status", status)
        )
        .paginate({
          cursor,
          numItems: ACTIVE_PRODUCT_GRANT_PAGE_SIZE,
        });
      const campaigns = await getAll(
        db,
        "tryoutAccessCampaigns",
        productGrantPage.page.map((productGrant) => productGrant.campaignId)
      );

      for (const [index, productGrant] of productGrantPage.page.entries()) {
        const campaign = campaigns[index];

        if (!campaign) {
          continue;
        }

        const accessEndsAt = getTryoutAccessGrantEffectiveEndsAt({
          campaign,
          endsAt: productGrant.endsAt,
        });

        if (accessEndsAt <= now) {
          continue;
        }

        if (status === "expired" && campaign.campaignKind !== "competition") {
          continue;
        }

        const eventSource = {
          accessCampaignId: campaign._id,
          accessCampaignKind: campaign.campaignKind,
          accessEndsAt,
          accessGrantId: productGrant.grantId,
        };

        if (eventSource.accessCampaignKind === "competition") {
          competitionEventSources.push(eventSource);
          continue;
        }

        if (
          !accessPassEventSource ||
          eventSource.accessEndsAt > accessPassEventSource.accessEndsAt
        ) {
          accessPassEventSource = eventSource;
        }
      }

      if (productGrantPage.isDone) {
        return;
      }

      cursor = productGrantPage.continueCursor;
    }
  }

  await readProductGrantStatusPage("active");
  await readProductGrantStatusPage("expired");

  return {
    accessPassEventSource,
    competitionEventSources,
  };
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
export async function resolveTryoutAccessSources(
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
): Promise<ActiveTryoutEventSources & { hasActiveSubscription: boolean }> {
  const [
    { accessPassEventSource, competitionEventSources },
    hasActiveSubscription,
  ] = await Promise.all([
    loadActiveTryoutEventSources(db, {
      now,
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
