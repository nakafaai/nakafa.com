import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import {
  type BillingOfferKey,
  billingOffer,
} from "@repo/backend/confect/billing/catalog";
import {
  BillingRowMissing,
  GrantOwnerMismatch,
} from "@repo/backend/confect/billing/spec";
import { readSubscription } from "@repo/backend/confect/billing/subscriptions";
import type { Space } from "@repo/backend/confect/space";
import {
  applyPlanChange,
  type PlanSource,
} from "@repo/backend/confect/triggers/subscriptions/impl";
import type { UserPlan } from "@repo/backend/confect/users/schema";
import {
  Array as Arr,
  DateTime,
  Duration,
  Effect,
  Option,
  Schema,
} from "effect";

/** The most school memberships one user is read through when a plan is projected. */
const MAX_MEMBERSHIPS_PER_USER = 50;
/** The members of a school one projection page reads, so a page stays inside one transaction. */
const SCHOOL_PROJECTION_PAGE = 50;

/** The subscription a grant covers: its ID, its seats, and its paid period. */
const SubscriptionGrantInput = Schema.Struct({
  id: IdSchema("billingSubscriptions"),
  seats: Schema.Int,
  validFrom: Schema.Finite,
  validTo: Schema.Finite,
});
type SubscriptionGrantInput = typeof SubscriptionGrantInput.Type;

type BillingAccountId = Docs["billingAccounts"]["_id"];
type BillingGrant = Docs["billingGrants"];

/** The account a subscription bills, or the broken invariant when no such account exists. */
const readAccount = Effect.fn("billing.grants.readAccount")(function* (
  accountId: BillingAccountId
) {
  const reader = yield* DatabaseReader;
  const account = yield* reader
    .table("billingAccounts")
    .get(accountId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (account === null) {
    return yield* new BillingRowMissing({
      table: "billingAccounts",
      message: `Account ${accountId} is gone.`,
    });
  }
  return account;
});

/** The grant a subscription writes: the owner's kind follows the offer's product. */
const grantFor = Effect.fn("billing.grants.grantFor")(function* (
  owner: Space,
  offer: BillingOfferKey,
  subscription: SubscriptionGrantInput
) {
  const source = {
    kind: "subscription" as const,
    subscriptionId: subscription.id,
  };
  const product = billingOffer(offer).product;
  if (owner.kind === "personal" && product === "pro") {
    return {
      product: "pro" as const,
      userId: owner.userId,
      source,
      validFrom: subscription.validFrom,
      validTo: subscription.validTo,
    };
  }
  if (owner.kind === "tenant" && product === "school") {
    return {
      product: "school" as const,
      tenantId: owner.tenantId,
      scope: { kind: "tenant" as const },
      seats: subscription.seats,
      ninaSeats: subscription.seats,
      source,
      validFrom: subscription.validFrom,
      validTo: subscription.validTo,
    };
  }
  return yield* new GrantOwnerMismatch({
    message: `${offer} cannot be granted to a ${owner.kind} owner.`,
  });
});

/**
 * Asks for the plans a grant's owner holds to be recomputed at once: one user for
 * a personal grant, every active member of the school for a school grant.
 */
const scheduleProjection = Effect.fn("billing.grants.scheduleProjection")(
  function* (owner: Space) {
    const scheduler = yield* Scheduler;
    if (owner.kind === "personal") {
      yield* scheduler.runAfter(
        Duration.zero,
        refs.internal.billing.grants.project,
        { userId: owner.userId }
      );
      return;
    }
    yield* scheduler.runAfter(
      Duration.zero,
      refs.internal.billing.grants.projectSchool,
      { tenantId: owner.tenantId, cursor: null }
    );
  }
);

/** Asks for every member of a school to have its plan recomputed, starting from the first page. */
export const scheduleSchoolProjection = Effect.fn(
  "billing.grants.scheduleSchoolProjection"
)(function* (tenantId: Docs["tenants"]["_id"]) {
  yield* (yield* Scheduler).runAfter(
    Duration.zero,
    refs.internal.billing.grants.projectSchool,
    { tenantId, cursor: null }
  );
});

/**
 * Writes the grant of one subscription. Its window is the paid period, so a
 * subscription that stops renewing keeps its access until that period ends.
 * Writing it again renews the same grant rather than adding one, and the owner's
 * plans are recomputed at once. A subscription with no period end has no window,
 * so it writes no grant and returns null.
 */
export const syncSubscriptionGrant = Effect.fn(
  "billing.grants.syncSubscription"
)(function* (subscriptionId: Docs["billingSubscriptions"]["_id"]) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const subscription = yield* readSubscription(subscriptionId);
  if (subscription === null) {
    return yield* new BillingRowMissing({
      table: "billingSubscriptions",
      message: `Subscription ${subscriptionId} is gone.`,
    });
  }
  const account = yield* readAccount(subscription.accountId);
  if (subscription.currentPeriodEnd === null) {
    return null;
  }
  const grant = yield* grantFor(account.owner, subscription.offer, {
    id: subscriptionId,
    seats: subscription.quantity,
    validFrom: subscription.currentPeriodStart,
    validTo: subscription.currentPeriodEnd,
  });
  const existing = yield* reader
    .table("billingGrants")
    .index("by_source_subscriptionId", (query) =>
      query.eq("source.subscriptionId", subscriptionId)
    )
    .first()
    .pipe(Effect.orDie);
  let grantId: Docs["billingGrants"]["_id"];
  if (Option.isSome(existing)) {
    grantId = existing.value._id;
    yield* writer
      .table("billingGrants")
      .replace(grantId, grant)
      .pipe(Effect.orDie);
  } else {
    grantId = yield* writer
      .table("billingGrants")
      .insert(grant)
      .pipe(Effect.orDie);
  }
  yield* scheduleProjection(account.owner);
  return grantId;
});

/** The Pro grant of one user that runs latest at `now`, if any runs. */
const latestPersonalGrant = Effect.fn("billing.grants.latestPersonal")(
  function* (userId: Docs["users"]["_id"], now: number) {
    const reader = yield* DatabaseReader;
    return yield* reader
      .table("billingGrants")
      .index(
        "by_userId_and_validTo",
        (query) => query.eq("userId", userId).gt("validTo", now),
        "desc"
      )
      .first()
      .pipe(Effect.orDie);
  }
);

/** The school grant of one school that runs latest at `now`, if any runs. */
const latestSchoolGrant = Effect.fn("billing.grants.latestSchool")(function* (
  tenantId: Docs["tenants"]["_id"],
  now: number
) {
  const reader = yield* DatabaseReader;
  return yield* reader
    .table("billingGrants")
    .index(
      "by_tenantId_and_validTo",
      (query) => query.eq("tenantId", tenantId).gt("validTo", now),
      "desc"
    )
    .first()
    .pipe(Effect.orDie);
});

/**
 * The school grant that runs latest among the schools a user is an active member
 * of, if any runs. A student keeps Pro for as long as the school's grant runs.
 */
const latestMembershipGrant = Effect.fn("billing.grants.latestMembership")(
  function* (userId: Docs["users"]["_id"], now: number) {
    const reader = yield* DatabaseReader;
    const memberships = yield* reader
      .table("tenantPeople")
      .index("by_account_userId_and_kind_and_status", (query) =>
        query
          .eq("account.userId", userId)
          .eq("kind", "member")
          .eq("status", "active")
      )
      .take(MAX_MEMBERSHIPS_PER_USER)
      .pipe(Effect.orDie);
    const grants = yield* Effect.forEach(memberships, (membership) =>
      latestSchoolGrant(membership.tenantId, now)
    );
    return latestOf(grants);
  }
);

/** The grant that runs latest of the given ones, or none when none of them runs. */
function latestOf(
  grants: readonly Option.Option<BillingGrant>[]
): Option.Option<BillingGrant> {
  return Arr.reduce(grants, Option.none<BillingGrant>(), (best, candidate) =>
    Option.match(candidate, {
      onNone: () => best,
      onSome: (grant) =>
        Option.match(best, {
          onNone: () => Option.some(grant),
          onSome: (current) =>
            grant.validTo > current.validTo ? Option.some(grant) : best,
        }),
    })
  );
}

/**
 * Recomputes one user's plan from the Pro grants that run at `now`, personal or
 * through a school they are a member of. It writes the plan through the existing
 * plan change when it differs, and schedules the next recomputation at the end of
 * the grant that runs latest. Returns the plan the user holds. A user whose account
 * is being deleted keeps the plan the deletion leaves.
 */
export const projectUserPlan = Effect.fn("billing.grants.projectUserPlan")(
  function* (userId: Docs["users"]["_id"], now: number) {
    const reader = yield* DatabaseReader;
    const user = yield* reader
      .table("users")
      .get(userId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (user === null || isAccountDeletionPending(user)) {
      return null;
    }
    const personal = yield* latestPersonalGrant(userId, now);
    const membership = yield* latestMembershipGrant(userId, now);
    const latest = latestOf([personal, membership]);
    const plan: UserPlan = Option.isSome(latest) ? "pro" : "free";
    if (plan !== user.plan) {
      const source: PlanSource = {
        id: Option.isSome(latest) ? latest.value._id : "expired",
        productId: "pro",
        status: Option.isSome(latest) ? "active" : "ended",
      };
      yield* applyPlanChange(user, plan, now, source);
    }
    if (Option.isSome(latest)) {
      yield* (yield* Scheduler).runAt(
        DateTime.makeUnsafe(latest.value.validTo),
        refs.internal.billing.grants.project,
        { userId }
      );
    }
    return plan;
  }
);

/**
 * Recomputes the plans of one page of a school's active members. Each page
 * schedules the next until the members are done, so a school of any size is
 * projected in bounded transactions. Only claimed members hold a user to project.
 */
export const projectSchoolPage = Effect.fn("billing.grants.projectSchoolPage")(
  function* (
    tenantId: Docs["tenants"]["_id"],
    cursor: string | null,
    now: number
  ) {
    const reader = yield* DatabaseReader;
    const page = yield* reader
      .table("tenantPeople")
      .index("by_tenantId_and_status", (query) =>
        query.eq("tenantId", tenantId).eq("status", "active")
      )
      .paginate({ cursor, numItems: SCHOOL_PROJECTION_PAGE })
      .pipe(Effect.orDie);
    const userIds = Arr.flatMap(page.page, (person) =>
      person.kind === "member" && person.account.state === "claimed"
        ? [person.account.userId]
        : []
    );
    yield* Effect.forEach(userIds, (userId) => projectUserPlan(userId, now), {
      discard: true,
    });
    if (!page.isDone) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        refs.internal.billing.grants.projectSchool,
        { tenantId, cursor: page.continueCursor }
      );
    }
    return null;
  }
);
