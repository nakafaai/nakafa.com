import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  tryoutEntitlementSourceKindCompetition,
  tryoutEntitlementSourceKindSubscription,
} from "@repo/backend/convex/tryoutAccess/schema";
import {
  ensureSubscriptionEntitlement,
  getSubscriptionEntitlementEndsAt,
  isActiveProSubscription,
  loadActiveProSubscription,
} from "@repo/backend/convex/tryouts/access/subscription";
import { tryoutAttemptAccessSourceKindSubscription } from "@repo/backend/convex/tryouts/schema";
import type {
  AttemptAccessFields,
  TryoutStartAccess,
  TryoutStartScope,
} from "@repo/backend/convex/tryouts/start/spec";
import { toTryoutStartError } from "@repo/backend/convex/tryouts/start/spec";
import { Effect } from "effect";

const ENTITLEMENT_LOOKUP_LIMIT = 50;

type ActiveEntitlement = Doc<"tryoutEntitlements">;
type SubscriptionDoc = Doc<"subscriptions">;
type TryoutAccessReadCtx = Pick<QueryCtx, "db">;

interface IncludedAccess {
  readonly access: AttemptAccessFields;
  readonly subscription?: SubscriptionDoc;
}

/** Resolves the advisory start state shown before the authoritative mutation. */
export const getTryoutStartAccess = Effect.fn(
  "tryouts.access.getTryoutStartAccess"
)(function* (ctx: TryoutAccessReadCtx, args: TryoutStartScope) {
  const included = yield* loadIncludedAccess(ctx, args);

  if (included) {
    return { kind: "included" } satisfies TryoutStartAccess;
  }

  const claim = yield* tryAccessPromise(() =>
    ctx.db
      .query("tryoutFreeAttemptClaims")
      .withIndex("by_userId", (query) => query.eq("userId", args.userId))
      .unique()
  );

  if (claim) {
    return { kind: "upgrade-required" } satisfies TryoutStartAccess;
  }

  return { kind: "free-attempt" } satisfies TryoutStartAccess;
});

/** Resolves premium access and materializes subscription entitlements on start. */
export const getIncludedAttemptAccess = Effect.fn(
  "tryouts.access.getIncludedAttemptAccess"
)(function* (ctx: MutationCtx, args: TryoutStartScope) {
  const included = yield* loadIncludedAccess(ctx, args);

  if (!included) {
    return null;
  }

  if (included.subscription) {
    yield* ensureSubscriptionEntitlement(ctx, {
      countryKey: args.countryKey,
      examKey: args.examKey,
      now: args.now,
      subscription: included.subscription,
      userId: args.userId,
    });
  }

  return included.access;
});

/** Finds a live scoped entitlement or active Pro subscription without writes. */
const loadIncludedAccess = Effect.fn("tryouts.access.loadIncludedAccess")(
  function* (ctx: TryoutAccessReadCtx, args: TryoutStartScope) {
    const entitlement = yield* loadActiveEntitlement(ctx, args);

    if (entitlement) {
      return { access: getAttemptAccessFields(entitlement) };
    }

    const subscription = yield* loadActiveProSubscription(ctx, args);

    if (!subscription) {
      return null;
    }

    const endsAt = getSubscriptionEntitlementEndsAt(subscription, args.now);

    if (!endsAt) {
      return null;
    }

    return {
      access: {
        accessEndsAt: endsAt,
        accessSourceKind: tryoutAttemptAccessSourceKindSubscription,
        accessSubscriptionId: subscription.id,
        countsForCompetition: false,
      },
      subscription,
    } satisfies IncludedAccess;
  }
);

/** Loads the earliest active entitlement across set, track, then exam scope. */
const loadActiveEntitlement = Effect.fn("tryouts.access.loadActiveEntitlement")(
  function* (ctx: TryoutAccessReadCtx, args: TryoutStartScope) {
    const scopes = [
      { setKey: args.setKey, trackKey: args.trackKey },
      { setKey: undefined, trackKey: args.trackKey },
      { setKey: undefined, trackKey: undefined },
    ];

    for (const scope of scopes) {
      const entitlements = yield* tryAccessPromise(() =>
        ctx.db
          .query("tryoutEntitlements")
          .withIndex("by_user_tryout_scope_endsAt", (query) =>
            query
              .eq("userId", args.userId)
              .eq("countryKey", args.countryKey)
              .eq("examKey", args.examKey)
              .eq("trackKey", scope.trackKey)
              .eq("setKey", scope.setKey)
              .gt("endsAt", args.now)
          )
          .order("asc")
          .take(ENTITLEMENT_LOOKUP_LIMIT)
      );

      for (const entitlement of entitlements) {
        if (entitlement.startsAt > args.now) {
          continue;
        }

        const active = yield* isSubscriptionEntitlementActive(
          ctx,
          entitlement,
          args.now
        );

        if (active) {
          return entitlement;
        }
      }
    }

    return null;
  }
);

/** Returns whether a subscription-backed entitlement still has a live source. */
const isSubscriptionEntitlementActive = Effect.fn(
  "tryouts.access.isSubscriptionEntitlementActive"
)(function* (
  ctx: TryoutAccessReadCtx,
  entitlement: ActiveEntitlement,
  now: number
) {
  if (entitlement.sourceKind !== tryoutEntitlementSourceKindSubscription) {
    return true;
  }

  if (!entitlement.subscriptionId) {
    return false;
  }

  const subscriptionId = entitlement.subscriptionId;

  const subscription = yield* tryAccessPromise(() =>
    ctx.db
      .query("subscriptions")
      .withIndex("by_subscriptionId", (query) => query.eq("id", subscriptionId))
      .unique()
  );

  return isActiveProSubscription(subscription, now);
});

/** Builds the immutable attempt access snapshot from one entitlement. */
function getAttemptAccessFields(
  entitlement: ActiveEntitlement
): AttemptAccessFields {
  const access: AttemptAccessFields = {
    accessEndsAt: entitlement.endsAt,
    accessSourceKind: entitlement.sourceKind,
    countsForCompetition:
      entitlement.sourceKind === tryoutEntitlementSourceKindCompetition,
  };

  return {
    ...access,
    ...(entitlement.accessCampaignId
      ? { accessCampaignId: entitlement.accessCampaignId }
      : {}),
    ...(entitlement.accessGrantId
      ? { accessGrantId: entitlement.accessGrantId }
      : {}),
    ...(entitlement.subscriptionId
      ? { accessSubscriptionId: entitlement.subscriptionId }
      : {}),
  };
}

/** Lifts one Convex read into the typed start failure channel. */
function tryAccessPromise<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({ catch: toTryoutStartError, try: operation });
}
