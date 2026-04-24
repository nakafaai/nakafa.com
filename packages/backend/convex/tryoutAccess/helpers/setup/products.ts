import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { TryoutAccessTargetProduct } from "@repo/backend/convex/tryoutAccess/helpers/setup/validators";
import type { tryoutAccessCampaignKindValidator } from "@repo/backend/convex/tryoutAccess/schema";
import type { Infer } from "convex/values";

type TryoutAccessCampaignKind = Infer<typeof tryoutAccessCampaignKindValidator>;

/** Returns a sorted, duplicate-free product list for stable setup comparisons. */
export function getUniqueCampaignProducts(
  targetProducts: TryoutAccessTargetProduct[]
) {
  return Array.from(new Set(targetProducts)).sort();
}

/** Returns whether two campaign product sets are identical. */
export function haveSameCampaignProducts({
  existingProducts,
  nextTargetProducts,
}: {
  existingProducts: TryoutAccessTargetProduct[];
  nextTargetProducts: TryoutAccessTargetProduct[];
}) {
  if (existingProducts.length !== nextTargetProducts.length) {
    return false;
  }

  return existingProducts.every(
    (product, index) => nextTargetProducts[index] === product
  );
}

/** Synchronizes one campaign's explicit product membership rows. */
export async function syncTryoutAccessCampaignProducts(
  ctx: Pick<MutationCtx, "db">,
  {
    campaignId,
    campaignKind,
    endsAt,
    targetProducts,
    startsAt,
  }: {
    campaignId: Doc<"tryoutAccessCampaigns">["_id"];
    campaignKind: TryoutAccessCampaignKind;
    endsAt: number;
    targetProducts: TryoutAccessTargetProduct[];
    startsAt: number;
  }
) {
  const existingRows = await ctx.db
    .query("tryoutAccessCampaignProducts")
    .withIndex("by_campaignId", (q) => q.eq("campaignId", campaignId))
    .collect();
  const rowsByProduct = new Map<
    TryoutAccessTargetProduct,
    Doc<"tryoutAccessCampaignProducts">[]
  >();

  for (const row of existingRows) {
    const rowsForProduct = rowsByProduct.get(row.product);

    if (rowsForProduct) {
      rowsForProduct.push(row);
      continue;
    }

    rowsByProduct.set(row.product, [row]);
  }

  for (const product of targetProducts) {
    const existingRowsForProduct = rowsByProduct.get(product) ?? [];
    const currentRow = existingRowsForProduct[0] ?? null;

    for (const duplicateRow of existingRowsForProduct.slice(1)) {
      await ctx.db.delete("tryoutAccessCampaignProducts", duplicateRow._id);
    }

    rowsByProduct.delete(product);

    if (!currentRow) {
      await ctx.db.insert("tryoutAccessCampaignProducts", {
        campaignId,
        product,
        campaignKind,
        startsAt,
        endsAt,
      });
      continue;
    }

    if (
      currentRow.campaignKind === campaignKind &&
      currentRow.startsAt === startsAt &&
      currentRow.endsAt === endsAt
    ) {
      continue;
    }

    await ctx.db.patch("tryoutAccessCampaignProducts", currentRow._id, {
      campaignKind,
      startsAt,
      endsAt,
    });
  }

  for (const staleRows of rowsByProduct.values()) {
    for (const staleRow of staleRows) {
      await ctx.db.delete("tryoutAccessCampaignProducts", staleRow._id);
    }
  }
}
