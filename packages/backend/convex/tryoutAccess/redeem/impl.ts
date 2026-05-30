import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import { syncTryoutAccessGrantEntitlements } from "@repo/backend/convex/tryoutAccess/helpers/entitlements";
import { getTryoutAccessEventByCode } from "@repo/backend/convex/tryoutAccess/helpers/events";
import {
  getTryoutAccessCampaignRedeemStatus,
  getTryoutAccessGrantEndsAt,
} from "@repo/backend/convex/tryoutAccess/helpers/status";
import {
  activeRedemptionKind,
  alreadyActiveRedemptionKind,
  disabledRedemptionKind,
  EventAccessReadError,
  EventAccessWriteError,
  EventProductsRequiredError,
  endedRedemptionKind,
  eventAccessReadFailedCode,
  eventAccessWriteFailedCode,
  eventProductsRequiredCode,
  InvalidCampaignWindowError,
  invalidCampaignWindowCode,
  notFoundRedemptionKind,
  notStartedRedemptionKind,
  type RedeemEventAccessInput,
  type RedeemEventAccessResult,
  usedRedemptionKind,
} from "@repo/backend/convex/tryoutAccess/redeem/spec";
import {
  tryoutAccessCampaignKindCompetition,
  tryoutAccessCampaignRedeemStatusEnded,
  tryoutAccessCampaignRedeemStatusScheduled,
  tryoutAccessGrantStatusActive,
} from "@repo/backend/convex/tryoutAccess/schema";
import { logger } from "@repo/backend/convex/utils/logger";
import { Effect } from "effect";

type EventAccessGrant = Pick<
  Doc<"tryoutAccessGrants">,
  "_id" | "campaignId" | "endsAt" | "redeemedAt" | "status" | "userId"
>;

/** Maps thrown read failures into the redeem domain error channel. */
function toEventAccessReadError(error: unknown) {
  return new EventAccessReadError({
    code: eventAccessReadFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

/** Maps thrown write and scheduler failures into the redeem domain error channel. */
function toEventAccessWriteError(error: unknown) {
  return new EventAccessWriteError({
    code: eventAccessWriteFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

/**
 * Loads the redeemable campaign/link/product bundle through the indexed helper.
 */
const readEventAccess = Effect.fn("tryoutAccess.readEventAccess")(function* (
  ctx: MutationCtx,
  code: string
) {
  return yield* Effect.tryPromise({
    try: () => getTryoutAccessEventByCode(ctx.db, code),
    catch: toEventAccessReadError,
  });
});

/** Reads the current user's grant without scanning unrelated grants. */
const readExistingGrant = Effect.fn("tryoutAccess.readExistingGrant")(
  function* (
    ctx: MutationCtx,
    userId: Doc<"users">["_id"],
    campaignId: Doc<"tryoutAccessCampaigns">["_id"]
  ) {
    return yield* Effect.tryPromise({
      try: () =>
        ctx.db
          .query("tryoutAccessGrants")
          .withIndex("by_userId_and_campaignId", (q) =>
            q.eq("userId", userId).eq("campaignId", campaignId)
          )
          .unique(),
      catch: toEventAccessReadError,
    });
  }
);

/** Computes the materialized grant expiry from the campaign kind. */
const getGrantEndsAt = Effect.fn("tryoutAccess.getGrantEndsAt")(function* (
  campaign: Doc<"tryoutAccessCampaigns">,
  redeemedAt: number
) {
  if (campaign.campaignKind === tryoutAccessCampaignKindCompetition) {
    return campaign.endsAt;
  }

  if (campaign.grantDurationDays !== undefined) {
    return getTryoutAccessGrantEndsAt({ campaign, redeemedAt });
  }

  return yield* Effect.fail(
    new InvalidCampaignWindowError({
      code: invalidCampaignWindowCode,
      message: "Access-pass campaigns must define grantDurationDays.",
    })
  );
});

/** Inserts the active grant row used by entitlement synchronization. */
const createActiveGrant = Effect.fn("tryoutAccess.createActiveGrant")(
  function* (
    ctx: MutationCtx,
    {
      campaign,
      endsAt,
      linkId,
      now,
      userId,
    }: {
      campaign: Doc<"tryoutAccessCampaigns">;
      endsAt: number;
      linkId: Doc<"tryoutAccessLinks">["_id"];
      now: number;
      userId: Doc<"users">["_id"];
    }
  ) {
    const grantStatus = tryoutAccessGrantStatusActive;

    const grantId = yield* Effect.tryPromise({
      try: () =>
        ctx.db.insert("tryoutAccessGrants", {
          campaignId: campaign._id,
          linkId,
          userId,
          redeemedAt: now,
          endsAt,
          status: grantStatus,
        }),
      catch: toEventAccessWriteError,
    });

    return {
      _id: grantId,
      campaignId: campaign._id,
      endsAt,
      redeemedAt: now,
      status: grantStatus,
      userId,
    } satisfies EventAccessGrant;
  }
);

/** Patches first redemption metadata, entitlements, and expiry scheduling. */
const materializeRedemption = Effect.fn("tryoutAccess.materializeRedemption")(
  function* (
    ctx: MutationCtx,
    {
      campaign,
      endsAt,
      grant,
      now,
    }: {
      campaign: Doc<"tryoutAccessCampaigns">;
      endsAt: number;
      grant: EventAccessGrant;
      now: number;
    }
  ) {
    yield* Effect.tryPromise({
      try: async () => {
        if (campaign.firstRedeemedAt == null) {
          await ctx.db.patch("tryoutAccessCampaigns", campaign._id, {
            firstRedeemedAt: now,
          });
        }

        await syncTryoutAccessGrantEntitlements(ctx.db, grant, campaign);

        await ctx.scheduler.runAfter(
          Math.max(0, endsAt - now),
          internal.tryoutAccess.mutations.internal.status.expireGrant,
          { grantId: grant._id }
        );
      },
      catch: toEventAccessWriteError,
    });
  }
);

/** Logs a redemption decision in the same local flow. */
const logRedemptionDecision = Effect.fn("tryoutAccess.logRedemptionDecision")(
  function* (
    level: "info" | "warn",
    message: string,
    context: {
      campaignId?: Doc<"tryoutAccessCampaigns">["_id"];
      code: string;
      grantId?: Doc<"tryoutAccessGrants">["_id"];
      userId: Doc<"users">["_id"];
    }
  ) {
    yield* Effect.sync(() => logger[level](message, context));
  }
);

/** Redeems one event access code and keeps the Convex mutation boundary thin. */
export const redeemEventAccessCode = Effect.fn(
  "tryoutAccess.redeemEventAccessCode"
)(function* (ctx: MutationCtx, input: RedeemEventAccessInput) {
  const { code, now, userId } = input;
  const eventAccess = yield* readEventAccess(ctx, code);

  if (!eventAccess) {
    yield* logRedemptionDecision(
      "warn",
      "Event access redeem denied because the code was not found",
      { code, userId }
    );

    return { kind: notFoundRedemptionKind } satisfies RedeemEventAccessResult;
  }

  const { campaign, link, products } = eventAccess;

  if (products.length === 0) {
    return yield* Effect.fail(
      new EventProductsRequiredError({
        code: eventProductsRequiredCode,
        message: "Event access campaign products cannot be empty.",
      })
    );
  }

  const existingGrant = yield* readExistingGrant(ctx, userId, campaign._id);

  if (existingGrant?.status === tryoutAccessGrantStatusActive) {
    yield* logRedemptionDecision(
      "info",
      "Event access already active for the current user",
      { campaignId: campaign._id, code, grantId: existingGrant._id, userId }
    );

    return {
      kind: alreadyActiveRedemptionKind,
      endsAt: existingGrant.endsAt,
      name: campaign.name,
    } satisfies RedeemEventAccessResult;
  }

  if (existingGrant) {
    yield* logRedemptionDecision(
      "warn",
      "Event access redeem denied because the code was already used",
      { campaignId: campaign._id, code, grantId: existingGrant._id, userId }
    );

    return {
      kind: usedRedemptionKind,
      endsAt: existingGrant.endsAt,
      name: campaign.name,
    } satisfies RedeemEventAccessResult;
  }

  if (!(link.enabled && campaign.enabled)) {
    yield* logRedemptionDecision(
      "warn",
      "Event access redeem denied because the campaign is disabled",
      { campaignId: campaign._id, code, userId }
    );

    return {
      kind: disabledRedemptionKind,
      name: campaign.name,
    } satisfies RedeemEventAccessResult;
  }

  const campaignRedeemStatus = getTryoutAccessCampaignRedeemStatus(
    campaign,
    now
  );

  if (campaignRedeemStatus === tryoutAccessCampaignRedeemStatusScheduled) {
    yield* logRedemptionDecision(
      "warn",
      "Event access redeem denied because the campaign has not started yet",
      { campaignId: campaign._id, code, userId }
    );

    return {
      kind: notStartedRedemptionKind,
      name: campaign.name,
    } satisfies RedeemEventAccessResult;
  }

  if (campaignRedeemStatus === tryoutAccessCampaignRedeemStatusEnded) {
    yield* logRedemptionDecision(
      "warn",
      "Event access redeem denied because the campaign has ended",
      { campaignId: campaign._id, code, userId }
    );

    return {
      kind: endedRedemptionKind,
      name: campaign.name,
    } satisfies RedeemEventAccessResult;
  }

  const endsAt = yield* getGrantEndsAt(campaign, now);
  const grant = yield* createActiveGrant(ctx, {
    campaign,
    endsAt,
    linkId: link._id,
    now,
    userId,
  });

  yield* materializeRedemption(ctx, { campaign, endsAt, grant, now });

  yield* logRedemptionDecision("info", "Event access redeemed", {
    campaignId: campaign._id,
    code,
    grantId: grant._id,
    userId,
  });

  return {
    kind: activeRedemptionKind,
    endsAt,
    name: campaign.name,
  } satisfies RedeemEventAccessResult;
});
