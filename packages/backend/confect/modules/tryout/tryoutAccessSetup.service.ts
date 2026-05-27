import { Ref } from "@confect/core";
import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import type { ConvexMutationCtx } from "@repo/backend/confect/modules/shared/convexContext";
import type { TryoutProduct } from "@repo/backend/confect/modules/tryout/products";
import { TryoutAccessError } from "@repo/backend/confect/modules/tryout/tryoutAccess.errors";
import {
  getTryoutAccessCampaignRedeemStatus,
  getUniqueCampaignProducts,
  haveSameCampaignProducts,
  normalizeTryoutAccessCode,
  syncTryoutAccessCampaignProducts,
} from "@repo/backend/confect/modules/tryout/tryoutAccessShared.service";
import { Clock, Effect } from "effect";

const COMPETITION_CAMPAIGN_CHECK_PAGE_SIZE = 100;

interface CampaignInput {
  readonly campaignKind: "access-pass" | "competition";
  readonly enabled: boolean;
  readonly endsAt: number;
  readonly grantDurationDays?: number;
  readonly name: string;
  readonly slug: string;
  readonly startsAt: number;
  readonly targetProducts: readonly TryoutProduct[];
}

interface LinkInput {
  readonly code: string;
  readonly enabled: boolean;
  readonly label: string;
}

/** Validates setup input before writing campaign rows. */
function validateCampaignInput(
  campaign: CampaignInput,
  uniqueTargetProducts: readonly TryoutProduct[]
) {
  if (campaign.endsAt <= campaign.startsAt) {
    return Effect.fail(
      new TryoutAccessError({
        code: "INVALID_CAMPAIGN_WINDOW",
        message: "Event access campaign end must be after its start.",
      })
    );
  }

  if (
    campaign.campaignKind === "competition" &&
    campaign.grantDurationDays !== undefined
  ) {
    return Effect.fail(
      new TryoutAccessError({
        code: "INVALID_GRANT_DURATION",
        message: "Competition campaigns cannot define grantDurationDays.",
      })
    );
  }

  if (
    campaign.campaignKind === "access-pass" &&
    (!campaign.grantDurationDays || campaign.grantDurationDays <= 0)
  ) {
    return Effect.fail(
      new TryoutAccessError({
        code: "INVALID_GRANT_DURATION",
        message: "Access-pass campaigns must define a positive grant duration.",
      })
    );
  }

  if (campaign.targetProducts.length === 0) {
    return Effect.fail(
      new TryoutAccessError({
        code: "INVALID_EVENT_PRODUCTS",
        message:
          "Event access campaign must include at least one tryout product.",
      })
    );
  }

  if (uniqueTargetProducts.length === campaign.targetProducts.length) {
    return Effect.succeed(null);
  }

  return Effect.fail(
    new TryoutAccessError({
      code: "DUPLICATE_EVENT_PRODUCTS",
      message: "Event access campaign products must be unique.",
    })
  );
}

/** Validates that the public redeem code is usable. */
function validateTryoutAccessCode(code: string) {
  if (code.length > 0) {
    return Effect.succeed(null);
  }

  return Effect.fail(
    new TryoutAccessError({
      code: "INVALID_EVENT_CODE",
      message: "Event access code cannot be empty.",
    })
  );
}

/** Ensures no competition campaign overlaps for the same product. */
const assertNoOverlappingCompetitionCampaign = Effect.fn(
  "tryoutAccess.assertNoOverlappingCompetitionCampaign"
)(function* (
  ctx: ConvexMutationCtx,
  args: {
    readonly endsAt: number;
    readonly existingCampaignId?: Id<"tryoutAccessCampaigns">;
    readonly startsAt: number;
    readonly targetProducts: readonly TryoutProduct[];
  }
) {
  for (const product of args.targetProducts) {
    let cursor: string | null = null;

    while (true) {
      const page = yield* Effect.promise(() =>
        ctx.db
          .query("tryoutAccessCampaignProducts")
          .withIndex("by_product_and_campaignKind_and_startsAt", (query) =>
            query
              .eq("product", product)
              .eq("campaignKind", "competition")
              .lt("startsAt", args.endsAt)
          )
          .paginate({
            cursor,
            numItems: COMPETITION_CAMPAIGN_CHECK_PAGE_SIZE,
          })
      );

      for (const candidate of page.page) {
        if (candidate.campaignId === args.existingCampaignId) {
          continue;
        }

        if (candidate.endsAt <= args.startsAt) {
          continue;
        }

        return yield* Effect.fail(
          new TryoutAccessError({
            code: "OVERLAPPING_COMPETITION_CAMPAIGN",
            message:
              "Competition campaigns cannot overlap for the same tryout product.",
          })
        );
      }

      if (page.isDone) {
        break;
      }

      cursor = page.continueCursor;
    }
  }
});

/** Builds a persisted campaign document from setup input. */
function buildCampaignDocument(args: {
  readonly campaign: CampaignInput;
  readonly existingCampaign: Doc<"tryoutAccessCampaigns"> | null;
  readonly now: number;
}) {
  return {
    campaignKind: args.campaign.campaignKind,
    enabled: args.campaign.enabled,
    endsAt: args.campaign.endsAt,
    firstRedeemedAt: args.existingCampaign?.firstRedeemedAt ?? null,
    grantDurationDays: args.campaign.grantDurationDays,
    name: args.campaign.name,
    redeemStatus: getTryoutAccessCampaignRedeemStatus(args.campaign, args.now),
    resultsFinalizedAt: args.existingCampaign?.resultsFinalizedAt ?? null,
    resultsStatus: args.existingCampaign?.resultsStatus ?? "pending",
    slug: args.campaign.slug,
    startsAt: args.campaign.startsAt,
  };
}

/** Checks if immutable campaign policy changed. */
function hasCampaignPolicyChange(args: {
  readonly existingCampaign: Doc<"tryoutAccessCampaigns">;
  readonly existingProducts: readonly TryoutProduct[];
  readonly nextCampaign: CampaignInput;
  readonly nextTargetProducts: readonly TryoutProduct[];
}) {
  return (
    args.existingCampaign.startsAt !== args.nextCampaign.startsAt ||
    args.existingCampaign.endsAt !== args.nextCampaign.endsAt ||
    args.existingCampaign.grantDurationDays !==
      args.nextCampaign.grantDurationDays ||
    !haveSameCampaignProducts({
      existingProducts: args.existingProducts,
      nextTargetProducts: args.nextTargetProducts,
    })
  );
}

/** Validates whether an existing campaign can be updated. */
function validateCampaignUpdate(args: {
  readonly campaignKind: "access-pass" | "competition";
  readonly existingCampaign: Doc<"tryoutAccessCampaigns">;
  readonly existingLink: Doc<"tryoutAccessLinks">;
  readonly existingProducts: readonly TryoutProduct[];
  readonly nextCampaign: CampaignInput;
  readonly nextTargetProducts: readonly TryoutProduct[];
}) {
  if (args.existingLink.campaignId !== args.existingCampaign._id) {
    return Effect.fail(
      new TryoutAccessError({
        code: "EVENT_SETUP_CONFLICT",
        message: "Event access slug and code point to different campaigns.",
      })
    );
  }

  if (args.existingCampaign.campaignKind !== args.campaignKind) {
    return Effect.fail(
      new TryoutAccessError({
        code: "CAMPAIGN_KIND_IMMUTABLE",
        message:
          "Campaign kind cannot change after the campaign has been created.",
      })
    );
  }

  const policyChanged = hasCampaignPolicyChange(args);

  if (args.existingCampaign.firstRedeemedAt == null) {
    if (args.existingCampaign.resultsStatus === "pending" || !policyChanged) {
      return Effect.succeed(null);
    }

    return Effect.fail(
      new TryoutAccessError({
        code: "CAMPAIGN_LIFECYCLE_IMMUTABLE",
        message:
          "A finished competition campaign cannot be reused for a new event window.",
      })
    );
  }

  if (!policyChanged) {
    return Effect.succeed(null);
  }

  return Effect.fail(
    new TryoutAccessError({
      code: "CAMPAIGN_POLICY_IMMUTABLE",
      message:
        "Campaign timing, products, and grant policy cannot change after the campaign has been redeemed.",
    })
  );
}

/** Schedules redeem-status and competition-finalization transitions. */
function scheduleCampaignStateTransitions(
  ctx: ConvexMutationCtx,
  args: {
    readonly campaign: CampaignInput;
    readonly campaignId: Id<"tryoutAccessCampaigns">;
    readonly now: number;
  }
) {
  return Effect.gen(function* () {
    if (args.campaign.startsAt > args.now) {
      yield* Effect.promise(() =>
        ctx.scheduler.runAfter(
          args.campaign.startsAt - args.now,
          Ref.getFunctionReference(
            refs.internal.tryoutAccess.mutations.internalFunctions.status
              .syncCampaignRedeemStatus
          ),
          { campaignId: args.campaignId }
        )
      );
    }

    if (args.campaign.endsAt > args.now) {
      yield* Effect.promise(() =>
        ctx.scheduler.runAfter(
          args.campaign.endsAt - args.now,
          Ref.getFunctionReference(
            refs.internal.tryoutAccess.mutations.internalFunctions.status
              .syncCampaignRedeemStatus
          ),
          { campaignId: args.campaignId }
        )
      );
    }

    if (args.campaign.campaignKind !== "competition") {
      return null;
    }

    yield* Effect.promise(() =>
      ctx.scheduler.runAfter(
        Math.max(0, args.campaign.endsAt - args.now),
        Ref.getFunctionReference(
          refs.internal.tryoutAccess.mutations.internalFunctions.competition
            .finalizeCompetitionCampaignResults
        ),
        { campaignId: args.campaignId }
      )
    );
  });
}

/** Upserts an event access campaign and its public link. */
export const upsertCampaignAndLink = Effect.fn(
  "tryoutAccess.upsertCampaignAndLink"
)(function* (args: {
  readonly campaign: CampaignInput;
  readonly link: LinkInput;
}) {
  const ctx = yield* MutationCtx;
  const now = yield* Clock.currentTimeMillis;
  const uniqueTargetProducts = getUniqueCampaignProducts(
    args.campaign.targetProducts
  );
  const code = normalizeTryoutAccessCode(args.link.code);

  yield* validateCampaignInput(args.campaign, uniqueTargetProducts);
  yield* validateTryoutAccessCode(code);

  const existingCampaign = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutAccessCampaigns")
      .withIndex("by_slug", (query) => query.eq("slug", args.campaign.slug))
      .unique()
  );
  const existingLink = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutAccessLinks")
      .withIndex("by_code", (query) => query.eq("code", code))
      .unique()
  );
  let existingProducts: Doc<"tryoutAccessCampaignProducts">[] = [];

  if (existingCampaign) {
    existingProducts = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutAccessCampaignProducts")
        .withIndex("by_campaignId", (query) =>
          query.eq("campaignId", existingCampaign._id)
        )
        .collect()
    );
  }
  const nextCampaign = buildCampaignDocument({
    campaign: args.campaign,
    existingCampaign,
    now,
  });

  if (args.campaign.campaignKind === "competition") {
    yield* assertNoOverlappingCompetitionCampaign(ctx, {
      endsAt: args.campaign.endsAt,
      existingCampaignId: existingCampaign?._id,
      startsAt: args.campaign.startsAt,
      targetProducts: uniqueTargetProducts,
    });
  }

  if (existingCampaign || existingLink) {
    if (!(existingCampaign && existingLink)) {
      return yield* Effect.fail(
        new TryoutAccessError({
          code: "EVENT_SETUP_CONFLICT",
          message: "Event access slug and code must reference the same record.",
        })
      );
    }

    yield* validateCampaignUpdate({
      campaignKind: args.campaign.campaignKind,
      existingCampaign,
      existingLink,
      existingProducts: existingProducts.map((row) => row.product),
      nextCampaign: args.campaign,
      nextTargetProducts: uniqueTargetProducts,
    });

    const nextLink = {
      campaignId: existingCampaign._id,
      code,
      enabled: args.link.enabled,
      label: args.link.label,
    };
    const shouldScheduleTransitions =
      existingCampaign.campaignKind !== args.campaign.campaignKind ||
      existingCampaign.endsAt !== args.campaign.endsAt ||
      existingCampaign.startsAt !== args.campaign.startsAt;

    yield* Effect.promise(() =>
      ctx.db.replace(existingCampaign._id, nextCampaign)
    );
    yield* Effect.promise(() => ctx.db.patch(existingLink._id, nextLink));
    yield* syncTryoutAccessCampaignProducts(ctx, {
      campaignId: existingCampaign._id,
      campaignKind: args.campaign.campaignKind,
      endsAt: args.campaign.endsAt,
      startsAt: args.campaign.startsAt,
      targetProducts: uniqueTargetProducts,
    });

    if (shouldScheduleTransitions) {
      yield* scheduleCampaignStateTransitions(ctx, {
        campaign: args.campaign,
        campaignId: existingCampaign._id,
        now,
      });
    }

    return { campaignId: existingCampaign._id, code, linkId: existingLink._id };
  }

  const campaignId = yield* Effect.promise(() =>
    ctx.db.insert("tryoutAccessCampaigns", nextCampaign)
  );
  const linkId = yield* Effect.promise(() =>
    ctx.db.insert("tryoutAccessLinks", {
      campaignId,
      code,
      enabled: args.link.enabled,
      label: args.link.label,
    })
  );

  yield* syncTryoutAccessCampaignProducts(ctx, {
    campaignId,
    campaignKind: args.campaign.campaignKind,
    endsAt: args.campaign.endsAt,
    startsAt: args.campaign.startsAt,
    targetProducts: uniqueTargetProducts,
  });
  yield* scheduleCampaignStateTransitions(ctx, {
    campaign: args.campaign,
    campaignId,
    now,
  });

  return { campaignId, code, linkId };
});
