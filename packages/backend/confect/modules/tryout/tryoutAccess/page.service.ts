import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { getOptionalAppUser } from "@repo/backend/confect/modules/identity/auth.service";
import {
  getTryoutAccessEventByCode,
  getTryoutAccessUnavailableReason,
} from "@repo/backend/confect/modules/tryout/tryoutAccessShared.service";
import { Effect, Option } from "effect";

/** Returns event landing page state for the current optional user. */
export const getEventPageState = Effect.fn("tryoutAccess.getEventPageState")(
  function* (args: { readonly code: string }) {
    const reader = yield* DatabaseReader;
    const eventAccess = yield* getTryoutAccessEventByCode(args.code);

    if (!eventAccess) {
      return {
        kind: "unavailable" as const,
        name: null,
        reason: "invalid-code" as const,
      };
    }

    const user = yield* getOptionalAppUser();

    if (user) {
      const existingGrant = yield* reader
        .table("tryoutAccessGrants")
        .index("by_userId_and_campaignId", (query) =>
          query
            .eq("userId", user.appUser._id)
            .eq("campaignId", eventAccess.campaign._id)
        )
        .first()
        .pipe(Effect.map(Option.getOrNull));

      if (existingGrant) {
        const activeEntitlement = yield* reader
          .table("userTryoutEntitlements")
          .index("by_accessGrantId", (query) =>
            query.eq("accessGrantId", existingGrant._id)
          )
          .first()
          .pipe(Effect.map(Option.getOrNull));

        if (existingGrant.status === "active" && activeEntitlement) {
          return {
            endsAt: activeEntitlement.endsAt,
            kind: "active" as const,
            name: eventAccess.campaign.name,
          };
        }

        return {
          endsAt: existingGrant.endsAt,
          kind: "used" as const,
          name: eventAccess.campaign.name,
        };
      }
    }

    const unavailableReason = getTryoutAccessUnavailableReason(eventAccess);

    if (unavailableReason) {
      return {
        kind: "unavailable" as const,
        name: eventAccess.campaign.name,
        reason: unavailableReason,
      };
    }

    if (!user) {
      return { kind: "sign-in" as const, name: eventAccess.campaign.name };
    }

    return { kind: "ready" as const, name: eventAccess.campaign.name };
  }
);
