import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/functions";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  getTryoutAccessCampaignRedeemStatus,
  normalizeTryoutAccessCode,
} from "@repo/backend/convex/tryoutAccess/helpers/access";
import {
  tryoutAccessCampaignKindValidator,
  type tryoutAccessCampaignValidator,
} from "@repo/backend/convex/tryoutAccess/schema";
import { tryoutProductValidator } from "@repo/backend/convex/tryouts/products";
import { ConvexError, type Infer, v } from "convex/values";

const COMPETITION_CAMPAIGN_CHECK_PAGE_SIZE = 50;

const tryoutAccessCampaignInputValidator = v.object({
  slug: v.string(),
  name: v.string(),
  products: v.array(tryoutProductValidator),
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
  uniqueProducts: Infer<typeof tryoutProductValidator>[]
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

  if (campaign.products.length === 0) {
    throw new ConvexError({
      code: "INVALID_EVENT_PRODUCTS",
      message:
        "Event access campaign must include at least one tryout product.",
    });
  }

  if (uniqueProducts.length !== campaign.products.length) {
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
    products,
    startsAt,
  }: {
    endsAt: number;
    existingCampaignId: string | undefined;
    products: Infer<typeof tryoutProductValidator>[];
    startsAt: number;
  }
) {
  let cursor: string | null = null;

  while (true) {
    const competitionPage = await ctx.db
      .query("tryoutAccessCampaigns")
      .withIndex("by_campaignKind_and_startsAt", (q) =>
        q.eq("campaignKind", "competition").lt("startsAt", endsAt)
      )
      .paginate({
        cursor,
        numItems: COMPETITION_CAMPAIGN_CHECK_PAGE_SIZE,
      });

    for (const campaign of competitionPage.page) {
      if (campaign._id === existingCampaignId) {
        continue;
      }

      if (campaign.endsAt <= startsAt) {
        continue;
      }

      if (!campaign.products.some((product) => products.includes(product))) {
        continue;
      }

      throw new ConvexError({
        code: "OVERLAPPING_COMPETITION_CAMPAIGN",
        message:
          "Competition campaigns cannot overlap for the same tryout product.",
      });
    }

    if (competitionPage.isDone) {
      return;
    }

    cursor = competitionPage.continueCursor;
  }
}

/** Returns whether one campaign rewrite would change its timed access policy. */
function hasCampaignPolicyChange({
  existingCampaign,
  nextCampaign,
}: {
  existingCampaign: Pick<
    Doc<"tryoutAccessCampaigns">,
    "endsAt" | "grantDurationDays" | "products" | "startsAt"
  >;
  nextCampaign: Pick<
    Infer<typeof tryoutAccessCampaignValidator>,
    "endsAt" | "grantDurationDays" | "products" | "startsAt"
  >;
}) {
  return (
    existingCampaign.startsAt !== nextCampaign.startsAt ||
    existingCampaign.endsAt !== nextCampaign.endsAt ||
    existingCampaign.grantDurationDays !== nextCampaign.grantDurationDays ||
    existingCampaign.products.length !== nextCampaign.products.length ||
    existingCampaign.products.some(
      (product, index) => nextCampaign.products[index] !== product
    )
  );
}

/** Rejects reusing an old finished competition lifecycle for a new window. */
function assertCampaignLifecycleCanBeReused({
  existingCampaign,
  nextCampaign,
}: {
  existingCampaign: Pick<Doc<"tryoutAccessCampaigns">, "resultsStatus"> &
    Pick<
      Doc<"tryoutAccessCampaigns">,
      "endsAt" | "grantDurationDays" | "products" | "startsAt"
    >;
  nextCampaign: Infer<typeof tryoutAccessCampaignValidator>;
}) {
  if (existingCampaign.resultsStatus === "pending") {
    return;
  }

  if (
    !hasCampaignPolicyChange({
      existingCampaign,
      nextCampaign,
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
async function assertCampaignCanBeUpdated(
  ctx: Pick<MutationCtx, "db">,
  {
    campaignKind,
    existingCampaign,
    existingLink,
    nextCampaign,
  }: {
    campaignKind: Infer<typeof tryoutAccessCampaignKindValidator>;
    existingCampaign: Doc<"tryoutAccessCampaigns">;
    existingLink: Doc<"tryoutAccessLinks">;
    nextCampaign: Infer<typeof tryoutAccessCampaignValidator>;
  }
) {
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

  const existingGrant = await ctx.db
    .query("tryoutAccessGrants")
    .withIndex("by_campaignId", (q) => q.eq("campaignId", existingCampaign._id))
    .first();
  const policyChanged = hasCampaignPolicyChange({
    existingCampaign,
    nextCampaign,
  });

  if (!existingGrant) {
    assertCampaignLifecycleCanBeReused({
      existingCampaign,
      nextCampaign,
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
    internal.tryoutAccess.mutations.internal.status
      .enqueueCompetitionCampaignFinalization,
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

    const uniqueProducts = Array.from(new Set(args.campaign.products));
    assertValidCampaignInput(args.campaign, uniqueProducts);

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
    const nextCampaign = {
      campaignKind: args.campaign.campaignKind,
      enabled: args.campaign.enabled,
      endsAt: args.campaign.endsAt,
      grantDurationDays: args.campaign.grantDurationDays,
      name: args.campaign.name,
      products: uniqueProducts,
      resultsFinalizedAt: existingCampaign?.resultsFinalizedAt ?? null,
      resultsStatus: existingCampaign?.resultsStatus ?? "pending",
      redeemStatus: getTryoutAccessCampaignRedeemStatus(args.campaign, now),
      slug: args.campaign.slug,
      startsAt: args.campaign.startsAt,
    };

    if (args.campaign.campaignKind === "competition") {
      await assertNoOverlappingCompetitionCampaign(ctx, {
        endsAt: args.campaign.endsAt,
        existingCampaignId: existingCampaign?._id,
        products: uniqueProducts,
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

      await assertCampaignCanBeUpdated(ctx, {
        campaignKind: args.campaign.campaignKind,
        existingCampaign,
        existingLink,
        nextCampaign,
      });

      await ctx.db.patch(
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
