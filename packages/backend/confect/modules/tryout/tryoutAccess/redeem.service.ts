import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth/session.service";
import { TryoutAccessError } from "@repo/backend/confect/modules/tryout/tryoutAccess.errors";
import { syncTryoutAccessGrantEntitlements } from "@repo/backend/confect/modules/tryout/tryoutAccessEntitlements.service";
import {
  getTryoutAccessCampaignRedeemStatus,
  getTryoutAccessEventByCode,
  getTryoutAccessGrantEndsAt,
} from "@repo/backend/confect/modules/tryout/tryoutAccessShared.service";
import { Clock, Duration, Effect, Option } from "effect";

/** Redeems an event access code for the current user. */
export const redeemEventAccess = Effect.fnUntraced(function* (args: {
  readonly code: string;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const scheduler = yield* Scheduler;
  const { appUser } = yield* requireAppUser();
  const now = yield* Clock.currentTimeMillis;
  const eventAccess = yield* getTryoutAccessEventByCode(args.code);

  if (!eventAccess) {
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

  const existingGrant = yield* reader
    .table("tryoutAccessGrants")
    .index("by_userId_and_campaignId", (query) =>
      query.eq("userId", appUser._id).eq("campaignId", eventAccess.campaign._id)
    )
    .first()
    .pipe(Effect.map(Option.getOrNull));

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
  const grantId = yield* writer.table("tryoutAccessGrants").insert({
    campaignId: eventAccess.campaign._id,
    endsAt,
    linkId: eventAccess.link._id,
    redeemedAt: now,
    status: "active",
    userId: appUser._id,
  });

  if (eventAccess.campaign.firstRedeemedAt == null) {
    yield* writer
      .table("tryoutAccessCampaigns")
      .patch(eventAccess.campaign._id, { firstRedeemedAt: now });
  }

  const grant = yield* reader.table("tryoutAccessGrants").get(grantId);

  yield* syncTryoutAccessGrantEntitlements(grant, eventAccess.campaign);

  yield* scheduler.runAfter(
    Duration.millis(Math.max(0, endsAt - now)),
    refs.internal.tryoutAccess.mutations.internalFunctions.status.expireGrant,
    { grantId }
  );

  return { endsAt, kind: "active" as const, name: eventAccess.campaign.name };
});
