import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { haveSameCampaignProducts } from "@repo/backend/convex/tryoutAccess/helpers/setup/products";
import type {
  TryoutAccessCampaignInput,
  TryoutAccessTargetProduct,
} from "@repo/backend/convex/tryoutAccess/helpers/setup/validators";
import { ConvexError } from "convex/values";

const COMPETITION_CAMPAIGN_CHECK_PAGE_SIZE = 100;

/** Validates the static policy fields for one campaign input. */
export function assertValidCampaignInput(
  campaign: TryoutAccessCampaignInput,
  uniqueTargetProducts: TryoutAccessTargetProduct[]
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

  if (uniqueTargetProducts.length === campaign.targetProducts.length) {
    return;
  }

  throw new ConvexError({
    code: "DUPLICATE_EVENT_PRODUCTS",
    message: "Event access campaign products must be unique.",
  });
}

/** Rejects overlapping competition campaigns for any shared tryout product. */
export async function assertNoOverlappingCompetitionCampaign(
  ctx: Pick<MutationCtx, "db">,
  {
    endsAt,
    existingCampaignId,
    targetProducts,
    startsAt,
  }: {
    endsAt: number;
    existingCampaignId: Doc<"tryoutAccessCampaigns">["_id"] | undefined;
    targetProducts: TryoutAccessTargetProduct[];
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
  existingProducts: TryoutAccessTargetProduct[];
  nextCampaign: Pick<
    TryoutAccessCampaignInput,
    "endsAt" | "grantDurationDays" | "startsAt"
  >;
  nextTargetProducts: TryoutAccessTargetProduct[];
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
  existingCampaign: Pick<
    Doc<"tryoutAccessCampaigns">,
    | "endsAt"
    | "firstRedeemedAt"
    | "grantDurationDays"
    | "resultsStatus"
    | "startsAt"
  >;
  existingProducts: TryoutAccessTargetProduct[];
  nextCampaign: Pick<
    TryoutAccessCampaignInput,
    "endsAt" | "grantDurationDays" | "startsAt"
  >;
  nextTargetProducts: TryoutAccessTargetProduct[];
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
export function assertCampaignCanBeUpdated({
  campaignKind,
  existingCampaign,
  existingProducts,
  existingLink,
  nextCampaign,
  nextTargetProducts,
}: {
  campaignKind: TryoutAccessCampaignInput["campaignKind"];
  existingCampaign: Doc<"tryoutAccessCampaigns">;
  existingProducts: TryoutAccessTargetProduct[];
  existingLink: Doc<"tryoutAccessLinks">;
  nextCampaign: Pick<
    TryoutAccessCampaignInput,
    "endsAt" | "grantDurationDays" | "startsAt"
  >;
  nextTargetProducts: TryoutAccessTargetProduct[];
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
