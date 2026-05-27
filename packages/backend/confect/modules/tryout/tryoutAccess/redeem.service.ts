import { Ref } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth.service";
import { TryoutAccessError } from "@repo/backend/confect/modules/tryout/tryoutAccess.errors";
import { syncTryoutAccessGrantEntitlements } from "@repo/backend/confect/modules/tryout/tryoutAccessEntitlements.service";
import {
  getTryoutAccessCampaignRedeemStatus,
  getTryoutAccessEventByCode,
  getTryoutAccessGrantEndsAt,
} from "@repo/backend/confect/modules/tryout/tryoutAccessShared.service";
import { Clock, Effect } from "effect";

/** Redeems an event access code for the current user. */
export const redeemEventAccess = Effect.fn("tryoutAccess.redeemEventAccess")(
  function* (args: { readonly code: string }) {
    const ctx = yield* MutationCtx;
    const { appUser } = yield* requireAppUser(ctx);
    const now = yield* Clock.currentTimeMillis;
    const eventAccess = yield* getTryoutAccessEventByCode(ctx.db, args.code);

    if (!eventAccess) {
      yield* Effect.logWarning("Event access redeem denied: code not found.", {
        code: args.code,
        userId: appUser._id,
      });
      return { kind: "not-found" as const };
    }

    if (eventAccess.products.length === 0) {
      return yield* Effect.fail(
        new TryoutAccessError({
          code: "EVENT_PRODUCTS_REQUIRED",
          message: "Event access campaign products cannot be empty.",
        })
      );
    }

    const existingGrant = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutAccessGrants")
        .withIndex("by_userId_and_campaignId", (query) =>
          query
            .eq("userId", appUser._id)
            .eq("campaignId", eventAccess.campaign._id)
        )
        .unique()
    );

    if (existingGrant?.status === "active") {
      return {
        endsAt: existingGrant.endsAt,
        kind: "already-active" as const,
        name: eventAccess.campaign.name,
      };
    }

    if (existingGrant) {
      return {
        endsAt: existingGrant.endsAt,
        kind: "used" as const,
        name: eventAccess.campaign.name,
      };
    }

    if (!(eventAccess.link.enabled && eventAccess.campaign.enabled)) {
      return { kind: "disabled" as const, name: eventAccess.campaign.name };
    }

    const campaignRedeemStatus = getTryoutAccessCampaignRedeemStatus(
      eventAccess.campaign,
      now
    );

    if (campaignRedeemStatus === "scheduled") {
      return { kind: "not-started" as const, name: eventAccess.campaign.name };
    }

    if (campaignRedeemStatus === "ended") {
      return { kind: "ended" as const, name: eventAccess.campaign.name };
    }

    const endsAt = yield* getTryoutAccessGrantEndsAt({
      campaign: eventAccess.campaign,
      redeemedAt: now,
    });
    const grantId = yield* Effect.promise(() =>
      ctx.db.insert("tryoutAccessGrants", {
        campaignId: eventAccess.campaign._id,
        endsAt,
        linkId: eventAccess.link._id,
        redeemedAt: now,
        status: "active",
        userId: appUser._id,
      })
    );

    if (eventAccess.campaign.firstRedeemedAt == null) {
      yield* Effect.promise(() =>
        ctx.db.patch(eventAccess.campaign._id, { firstRedeemedAt: now })
      );
    }

    const grant = yield* Effect.promise(() => ctx.db.get(grantId));

    if (grant) {
      yield* syncTryoutAccessGrantEntitlements(
        ctx.db,
        grant,
        eventAccess.campaign
      );
    }

    yield* Effect.promise(() =>
      ctx.scheduler.runAfter(
        Math.max(0, endsAt - now),
        Ref.getFunctionReference(
          refs.internal.tryoutAccess.mutations.internalFunctions.status
            .expireGrant
        ),
        { grantId }
      )
    );

    yield* Effect.logInfo("Event access redeemed.", {
      campaignId: eventAccess.campaign._id,
      grantId,
      userId: appUser._id,
    });

    return { endsAt, kind: "active" as const, name: eventAccess.campaign.name };
  }
);
