import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { tryoutAccessCampaignKindValidator } from "@repo/backend/convex/tryoutAccess/schema";
import type { tryoutProductValidator } from "@repo/backend/convex/tryouts/products";
import type { Infer } from "convex/values";

/** Inserts one access campaign together with its explicit product relation rows. */
export async function insertTryoutAccessCampaign(
  ctx: MutationCtx,
  {
    campaignKind,
    enabled,
    endsAt,
    grantDurationDays,
    name,
    products,
    redeemStatus,
    resultsFinalizedAt,
    resultsStatus,
    slug,
    startsAt,
  }: {
    campaignKind: Infer<typeof tryoutAccessCampaignKindValidator>;
    enabled: boolean;
    endsAt: number;
    grantDurationDays?: number;
    name: string;
    products: Infer<typeof tryoutProductValidator>[];
    redeemStatus: Doc<"tryoutAccessCampaigns">["redeemStatus"];
    resultsFinalizedAt: number | null;
    resultsStatus: Doc<"tryoutAccessCampaigns">["resultsStatus"];
    slug: string;
    startsAt: number;
  }
) {
  const campaignId = await ctx.db.insert("tryoutAccessCampaigns", {
    campaignKind,
    enabled,
    endsAt,
    grantDurationDays,
    name,
    redeemStatus,
    resultsFinalizedAt,
    resultsStatus,
    slug,
    startsAt,
  });

  for (const product of products) {
    await ctx.db.insert("tryoutAccessCampaignProducts", {
      campaignId,
      product,
      campaignKind,
      startsAt,
      endsAt,
    });
  }

  return campaignId;
}
