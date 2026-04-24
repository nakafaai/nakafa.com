import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { listTryoutAccessCampaignProducts } from "@repo/backend/convex/tryoutAccess/helpers/campaignProducts";
import { normalizeTryoutAccessCode } from "@repo/backend/convex/tryoutAccess/helpers/codes";
import type { TryoutAccessDbReader } from "@repo/backend/convex/tryoutAccess/helpers/types";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";

interface TryoutAccessEvent {
  campaign: Doc<"tryoutAccessCampaigns">;
  link: Doc<"tryoutAccessLinks">;
  products: TryoutProduct[];
}

/** Loads the campaign, link, and scoped products for one public event code. */
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

  const products = await listTryoutAccessCampaignProducts(db, campaign._id);

  return {
    campaign,
    link,
    products,
  } satisfies TryoutAccessEvent;
}
