import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  getTryoutAccessCampaignRedeemStatus,
  normalizeTryoutAccessCode,
} from "@repo/backend/convex/tryoutAccess/helpers/access";
import { tryoutAccessCampaignKindValidator } from "@repo/backend/convex/tryoutAccess/schema";
import { tryoutProductValidator } from "@repo/backend/convex/tryouts/products";
import { ConvexError, type Infer, v } from "convex/values";

const COMPETITION_CAMPAIGN_CHECK_PAGE_SIZE = 100;

const tryoutAccessCampaignInputValidator = v.object({
  slug: v.string(),
  name: v.string(),
  targetProducts: v.array(tryoutProductValidator),
  campaignKind: tryoutAccessCampaignKindValidator,
  enabled: v.boolean(),
  startsAt: v.number(),
  endsAt: v.number(),
  grantDurationDays: v.optional(v.number()),
});

const tryoutAccessLinkInputValidator = v.object({
  code: v.string(),
  label: v.string(),
  enabled: v.boolean(),
});

/** Validates the static policy fields for one campaign input. */
function assertValidCampaignInput(
  campaign: Infer<typeof tryoutAccessCampaignInputValidator>,
  uniqueTargetProducts: Infer<typeof tryoutProductValidator>[]
) {
  if (campaign.endsAt <= campaign.startsAt) {
    throw new ConvexError({
      code: "INVALID_CAMPAIGN_WINDOW",
      message: "Event access campaign end must be after its start.",
    });
  }

  if (
    campaign.campaignKind === "competition" &&
    campaign.grantDurationDays !== undefined
  ) {
    throw new ConvexError({
      code: "INVALID_GRANT_DURATION",
      message: "Competition campaigns cannot define grantDurationDays.",
    });
  }

  if (
    campaign.campaignKind === "access-pass" &&
    (!campaign.grantDurationDays || campaign.grantDurationDays <= 0)
  ) {
    throw new ConvexError({
      code: "INVALID_GRANT_DURATION",
      message: "Access-pass campaigns must define a positive grant duration.",
    });
  }

  if (campaign.targetProducts.length === 0) {
    throw new ConvexError({
      code: "INVALID_EVENT_PRODUCTS",
      message:
        "Event access campaign must include at least one tryout product.",
    });
  }

  if (uniqueTargetProducts.length !== campaign.targetProducts.length) {
    throw new ConvexError({
      code: "DUPLICATE_EVENT_PRODUCTS",
      message: "Event access campaign products must be unique.",
    });
  }
}

/** Rejects overlapping competition campaigns for any shared tryout product. */
async function assertNoOverlappingCompetitionCampaign(
  ctx: Pick<MutationCtx, "db">,
  {
    endsAt,
    existingCampaignId,
    targetProducts,
    startsAt,
  }: {
    endsAt: number;
    existingCampaignId: string | undefined;
    targetProducts: Infer<typeof tryoutProductValidator>[];
    startsAt: number;
  }
) {
  for (const product of targetProducts) {
    let continueCursor: string | null = null;

    while (true) {
      const page = await ctx.db
        .query("tryoutAccessCampaignProducts")
        .withIndex("by_product_and_campaignKind_and_startsAt", (q) =>
          q
            .eq("product", product)
            .eq("campaignKind", "competition")
            .lt("startsAt", endsAt)
        )
        .paginate({
          cursor: continueCursor,
          numItems: COMPETITION_CAMPAIGN_CHECK_PAGE_SIZE,
        });

      for (const candidate of page.page) {
        if (candidate.campaignId === existingCampaignId) {
          continue;
        }

        if (candidate.endsAt <= startsAt) {
          continue;
        }

        throw new ConvexError({
          code: "OVERLAPPING_COMPETITION_CAMPAIGN",
          message:
            "Competition campaigns cannot overlap for the same tryout product.",
        });
      }

      if (page.isDone) {
        break;
      }

      continueCursor = page.continueCursor;
    }
  }
}

/** Returns whether two campaign product sets are identical. */
function haveSameCampaignProducts({
  existingProducts,
  nextTargetProducts,
}: {
  existingProducts: Infer<typeof tryoutProductValidator>[];
  nextTargetProducts: Infer<typeof tryoutProductValidator>[];
}) {
  if (existingProducts.length !== nextTargetProducts.length) {
    return false;
  }

  return existingProducts.every(
    (product, index) => nextTargetProducts[index] === product
  );
}

/** Synchronizes one campaign's explicit product membership rows. */
async function syncTryoutAccessCampaignProducts(
  ctx: Pick<MutationCtx, "db">,
  {
    campaignId,
    campaignKind,
    endsAt,
    targetProducts,
    startsAt,
  }: {
    campaignId: Doc<"tryoutAccessCampaigns">["_id"];
    campaignKind: Infer<typeof tryoutAccessCampaignKindValidator>;
    endsAt: number;
    targetProducts: Infer<typeof tryoutProductValidator>[];
    startsAt: number;
  }
) {
  const existingRows = await ctx.db
    .query("tryoutAccessCampaignProducts")
    .withIndex("by_campaignId", (q) => q.eq("campaignId", campaignId))
    .collect();
  const rowsByProduct = new Map<
    (typeof targetProducts)[number],
    typeof existingRows
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
      currentRow.campaignId === campaignId &&
      currentRow.product === product &&
      currentRow.campaignKind === campaignKind &&
      currentRow.startsAt === startsAt &&
      currentRow.endsAt === endsAt
    ) {
      continue;
    }

    await ctx.db.patch("tryoutAccessCampaignProducts", currentRow._id, {
      campaignId,
      product,
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

/** Returns whether one campaign rewrite would change its timed access policy. */
function hasCampaignPolicyChange({
  existingCampaign,
  existingProducts,
  nextCampaign,
  nextTargetProducts,
}: {
  existingCampaign: Pick<
    Doc<"tryoutAccessCampaigns">,
    "endsAt" | "grantDurationDays" | "startsAt"
  >;
  existingProducts: Infer<typeof tryoutProductValidator>[];
  nextCampaign: Pick<
    Infer<typeof tryoutAccessCampaignInputValidator>,
    "endsAt" | "grantDurationDays" | "startsAt"
  >;
  nextTargetProducts: Infer<typeof tryoutProductValidator>[];
}) {
  return (
    existingCampaign.startsAt !== nextCampaign.startsAt ||
    existingCampaign.endsAt !== nextCampaign.endsAt ||
    existingCampaign.grantDurationDays !== nextCampaign.grantDurationDays ||
    !haveSameCampaignProducts({
      existingProducts,
      nextTargetProducts,
    })
  );
}

/** Rejects reusing an old finished competition lifecycle for a new window. */
function assertCampaignLifecycleCanBeReused({
  existingCampaign,
  existingProducts,
  nextCampaign,
  nextTargetProducts,
}: {
  existingCampaign: Pick<Doc<"tryoutAccessCampaigns">, "resultsStatus"> &
    Pick<
      Doc<"tryoutAccessCampaigns">,
      "endsAt" | "firstRedeemedAt" | "grantDurationDays" | "startsAt"
    >;
  existingProducts: Infer<typeof tryoutProductValidator>[];
  nextCampaign: Pick<
    Infer<typeof tryoutAccessCampaignInputValidator>,
    "endsAt" | "grantDurationDays" | "startsAt"
  >;
  nextTargetProducts: Infer<typeof tryoutProductValidator>[];
}) {
  if (existingCampaign.resultsStatus === "pending") {
    return;
  }

  if (
    !hasCampaignPolicyChange({
      existingCampaign,
      existingProducts,
      nextCampaign,
      nextTargetProducts,
    })
  ) {
    return;
  }

  throw new ConvexError({
    code: "CAMPAIGN_LIFECYCLE_IMMUTABLE",
    message:
      "A finished competition campaign cannot be reused for a new event window.",
  });
}

/** Rejects policy edits once a campaign has already been redeemed. */
function assertCampaignCanBeUpdated({
  campaignKind,
  existingCampaign,
  existingProducts,
  existingLink,
  nextCampaign,
  nextTargetProducts,
}: {
  campaignKind: Infer<typeof tryoutAccessCampaignKindValidator>;
  existingCampaign: Doc<"tryoutAccessCampaigns">;
  existingProducts: Infer<typeof tryoutProductValidator>[];
  existingLink: Doc<"tryoutAccessLinks">;
  nextCampaign: Pick<
    Infer<typeof tryoutAccessCampaignInputValidator>,
    "endsAt" | "grantDurationDays" | "startsAt"
  >;
  nextTargetProducts: Infer<typeof tryoutProductValidator>[];
}) {
  if (existingLink.campaignId !== existingCampaign._id) {
    throw new ConvexError({
      code: "EVENT_SETUP_CONFLICT",
      message: "Event access slug and code point to different campaigns.",
    });
  }

  if (existingCampaign.campaignKind !== campaignKind) {
    throw new ConvexError({
      code: "CAMPAIGN_KIND_IMMUTABLE",
      message:
        "Campaign kind cannot change after the campaign has been created.",
    });
  }

  const policyChanged = hasCampaignPolicyChange({
    existingCampaign,
    existingProducts,
    nextCampaign,
    nextTargetProducts,
  });

  if (existingCampaign.firstRedeemedAt == null) {
    assertCampaignLifecycleCanBeReused({
      existingCampaign,
      existingProducts,
      nextCampaign,
      nextTargetProducts,
    });

    return;
  }

  if (!policyChanged) {
    return;
  }

  throw new ConvexError({
    code: "CAMPAIGN_POLICY_IMMUTABLE",
    message:
      "Campaign timing, products, and grant policy cannot change after the campaign has been redeemed.",
  });
}

/** Schedules the future redeem/finalization transitions for one campaign. */
async function scheduleCampaignStateTransitions(
  ctx: Pick<MutationCtx, "scheduler">,
  {
    campaign,
    campaignId,
    now,
  }: {
    campaign: Infer<typeof tryoutAccessCampaignInputValidator>;
    campaignId: Doc<"tryoutAccessCampaigns">["_id"];
    now: number;
  }
) {
  if (campaign.startsAt > now) {
    await ctx.scheduler.runAfter(
      campaign.startsAt - now,
      internal.tryoutAccess.mutations.internal.status.syncCampaignRedeemStatus,
      {
        campaignId,
      }
    );
  }

  if (campaign.endsAt > now) {
    await ctx.scheduler.runAfter(
      campaign.endsAt - now,
      internal.tryoutAccess.mutations.internal.status.syncCampaignRedeemStatus,
      {
        campaignId,
      }
    );
  }

  if (campaign.campaignKind !== "competition") {
    return;
  }

  await ctx.scheduler.runAfter(
    Math.max(0, campaign.endsAt - now),
    internal.tryoutAccess.mutations.internal.competition
      .finalizeCompetitionCampaignResults,
    {
      campaignId,
    }
  );
}

/** Upserts one event access campaign and one redeem link for ops setup. */
export const upsertCampaignAndLink = internalMutation({
  args: {
    campaign: tryoutAccessCampaignInputValidator,
    link: tryoutAccessLinkInputValidator,
  },
  returns: v.object({
    campaignId: vv.id("tryoutAccessCampaigns"),
    code: v.string(),
    linkId: vv.id("tryoutAccessLinks"),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();

    const uniqueTargetProducts = Array.from(
      new Set(args.campaign.targetProducts)
    ).sort();
    assertValidCampaignInput(args.campaign, uniqueTargetProducts);

    const code = normalizeTryoutAccessCode(args.link.code);

    if (code.length === 0) {
      throw new ConvexError({
        code: "INVALID_EVENT_CODE",
        message: "Event access code cannot be empty.",
      });
    }

    const existingCampaign = await ctx.db
      .query("tryoutAccessCampaigns")
      .withIndex("by_slug", (q) => q.eq("slug", args.campaign.slug))
      .unique();
    const existingLink = await ctx.db
      .query("tryoutAccessLinks")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    const existingProducts = existingCampaign
      ? await ctx.db
          .query("tryoutAccessCampaignProducts")
          .withIndex("by_campaignId", (q) =>
            q.eq("campaignId", existingCampaign._id)
          )
          .collect()
      : [];
    const nextCampaign = {
      campaignKind: args.campaign.campaignKind,
      enabled: args.campaign.enabled,
      endsAt: args.campaign.endsAt,
      grantDurationDays: args.campaign.grantDurationDays,
      name: args.campaign.name,
      resultsFinalizedAt: existingCampaign?.resultsFinalizedAt ?? null,
      firstRedeemedAt: existingCampaign?.firstRedeemedAt ?? null,
      resultsStatus: existingCampaign?.resultsStatus ?? "pending",
      redeemStatus: getTryoutAccessCampaignRedeemStatus(args.campaign, now),
      slug: args.campaign.slug,
      startsAt: args.campaign.startsAt,
    };

    if (args.campaign.campaignKind === "competition") {
      await assertNoOverlappingCompetitionCampaign(ctx, {
        endsAt: args.campaign.endsAt,
        existingCampaignId: existingCampaign?._id,
        targetProducts: uniqueTargetProducts,
        startsAt: args.campaign.startsAt,
      });
    }

    if (existingCampaign || existingLink) {
      if (!(existingCampaign && existingLink)) {
        throw new ConvexError({
          code: "EVENT_SETUP_CONFLICT",
          message: "Event access slug and code must reference the same record.",
        });
      }

      assertCampaignCanBeUpdated({
        campaignKind: args.campaign.campaignKind,
        existingCampaign,
        existingProducts: existingProducts.map((row) => row.product),
        existingLink,
        nextCampaign,
        nextTargetProducts: uniqueTargetProducts,
      });

      await ctx.db.replace(
        "tryoutAccessCampaigns",
        existingCampaign._id,
        nextCampaign
      );
      await ctx.db.patch("tryoutAccessLinks", existingLink._id, {
        campaignId: existingCampaign._id,
        code,
        enabled: args.link.enabled,
        label: args.link.label,
      });
      await syncTryoutAccessCampaignProducts(ctx, {
        campaignId: existingCampaign._id,
        campaignKind: args.campaign.campaignKind,
        endsAt: args.campaign.endsAt,
        targetProducts: uniqueTargetProducts,
        startsAt: args.campaign.startsAt,
      });

      await scheduleCampaignStateTransitions(ctx, {
        campaign: args.campaign,
        campaignId: existingCampaign._id,
        now,
      });

      return {
        campaignId: existingCampaign._id,
        code,
        linkId: existingLink._id,
      };
    }

    const campaignId = await ctx.db.insert(
      "tryoutAccessCampaigns",
      nextCampaign
    );
    const linkId = await ctx.db.insert("tryoutAccessLinks", {
      campaignId,
      code,
      enabled: args.link.enabled,
      label: args.link.label,
    });
    await syncTryoutAccessCampaignProducts(ctx, {
      campaignId,
      campaignKind: args.campaign.campaignKind,
      endsAt: args.campaign.endsAt,
      targetProducts: uniqueTargetProducts,
      startsAt: args.campaign.startsAt,
    });

    await scheduleCampaignStateTransitions(ctx, {
      campaign: args.campaign,
      campaignId,
      now,
    });

    return {
      campaignId,
      code,
      linkId,
    };
  },
});
