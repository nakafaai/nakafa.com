import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { TryoutAccessDbReader } from "@repo/backend/convex/tryoutAccess/helpers/types";

/** Lists the explicit product membership rows for one access campaign. */
export async function listTryoutAccessCampaignProducts(
  db: TryoutAccessDbReader,
  campaignId: Doc<"tryoutAccessCampaigns">["_id"]
) {
  const rows = await db
    .query("tryoutAccessCampaignProducts")
    .withIndex("by_campaignId", (q) => q.eq("campaignId", campaignId))
    .collect();

  return rows.map((row) => row.product);
}
