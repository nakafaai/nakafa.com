import { QueryCtx } from "@repo/backend/confect/_generated/services";
import type { TryoutProduct } from "@repo/backend/confect/modules/tryout/products";
import { Effect } from "effect";

interface PaginationOpts {
  readonly cursor: string | null;
  readonly endCursor?: string | null;
  readonly id?: number;
  readonly maximumBytesRead?: number;
  readonly maximumRowsRead?: number;
  readonly numItems: number;
}

/** Checks campaign state integrity. */
export const getTryoutAccessCampaignIntegrity = Effect.fn(
  "tryoutAccess.getCampaignIntegrity"
)(function* (args: {
  readonly nowMs: number;
  readonly paginationOpts: PaginationOpts;
}) {
  const ctx = yield* QueryCtx;
  const campaigns = yield* Effect.promise(() =>
    ctx.db.query("tryoutAccessCampaigns").paginate(args.paginationOpts)
  );
  let overdueActiveCampaignCount = 0;
  let overduePendingCompetitionCount = 0;
  let overdueScheduledCampaignCount = 0;

  for (const campaign of campaigns.page) {
    if (
      campaign.redeemStatus === "scheduled" &&
      campaign.startsAt <= args.nowMs
    ) {
      overdueScheduledCampaignCount += 1;
    }

    if (campaign.redeemStatus === "active" && campaign.endsAt <= args.nowMs) {
      overdueActiveCampaignCount += 1;
    }

    if (
      campaign.campaignKind === "competition" &&
      campaign.endsAt <= args.nowMs &&
      campaign.resultsStatus === "pending"
    ) {
      overduePendingCompetitionCount += 1;
    }
  }

  return {
    continueCursor: campaigns.continueCursor,
    isDone: campaigns.isDone,
    overdueActiveCampaignCount,
    overduePendingCompetitionCount,
    overdueScheduledCampaignCount,
  };
});

/** Checks grant state integrity. */
export const getTryoutAccessGrantIntegrity = Effect.fn(
  "tryoutAccess.getGrantIntegrity"
)(function* (args: {
  readonly nowMs: number;
  readonly paginationOpts: PaginationOpts;
}) {
  const ctx = yield* QueryCtx;
  const grants = yield* Effect.promise(() =>
    ctx.db.query("tryoutAccessGrants").paginate(args.paginationOpts)
  );
  const overdueActiveGrantCount = grants.page.filter(
    (grant) => grant.status === "active" && grant.endsAt <= args.nowMs
  ).length;

  return {
    continueCursor: grants.continueCursor,
    isDone: grants.isDone,
    overdueActiveGrantCount,
  };
});

/** Checks entitlement state integrity. */
export const getTryoutAccessEntitlementIntegrity = Effect.fn(
  "tryoutAccess.getEntitlementIntegrity"
)(function* (args: {
  readonly nowMs: number;
  readonly paginationOpts: PaginationOpts;
}) {
  const ctx = yield* QueryCtx;
  const entitlements = yield* Effect.promise(() =>
    ctx.db.query("userTryoutEntitlements").paginate(args.paginationOpts)
  );
  const overdueEntitlementCount = entitlements.page.filter(
    (entitlement) => entitlement.endsAt <= args.nowMs
  ).length;

  return {
    continueCursor: entitlements.continueCursor,
    isDone: entitlements.isDone,
    overdueEntitlementCount,
  };
});

/** Lists competition campaign product windows by product. */
export const listCompetitionCampaignProductsByProduct = Effect.fn(
  "tryoutAccess.listCompetitionCampaignProductsByProduct"
)(function* (args: {
  readonly paginationOpts: PaginationOpts;
  readonly product: TryoutProduct;
}) {
  const ctx = yield* QueryCtx;
  const rows = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutAccessCampaignProducts")
      .withIndex("by_product_and_campaignKind_and_startsAt", (query) =>
        query.eq("product", args.product).eq("campaignKind", "competition")
      )
      .paginate(args.paginationOpts)
  );

  return {
    continueCursor: rows.continueCursor,
    isDone: rows.isDone,
    page: rows.page.map((row) => ({
      campaignId: row.campaignId,
      endsAt: row.endsAt,
      startsAt: row.startsAt,
    })),
  };
});
