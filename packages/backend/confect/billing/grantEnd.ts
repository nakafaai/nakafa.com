import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { scheduleProjection } from "@repo/backend/confect/billing/grants";
import type { Space } from "@repo/backend/confect/space";
import { Effect, Option } from "effect";

type BillingGrant = Docs["billingGrants"];

/** The owner a grant belongs to: its user for Pro, its school for a school grant. */
const ownerOfGrant = (grant: BillingGrant): Space =>
  grant.product === "pro"
    ? { kind: "personal", userId: grant.userId }
    : { kind: "tenant", tenantId: grant.tenantId };

/**
 * Ends the grant of one subscription at `endsAt`, and never extends it: a grant
 * that already ends earlier keeps its end. The owner's plans are recomputed at
 * once, so a user whose last grant ends drops to free now. Returns the grant that
 * ended, or null when no grant of the subscription runs past `endsAt`.
 */
export const endSubscriptionGrant = Effect.fn("billing.grants.endSubscription")(
  function* (
    subscriptionId: Docs["billingSubscriptions"]["_id"],
    endsAt: number
  ) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const existing = yield* reader
      .table("billingGrants")
      .index("by_source_subscriptionId", (query) =>
        query.eq("source.subscriptionId", subscriptionId)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isNone(existing) || existing.value.validTo <= endsAt) {
      return null;
    }
    yield* writer
      .table("billingGrants")
      .patch(existing.value._id, { validTo: endsAt })
      .pipe(Effect.orDie);
    yield* scheduleProjection(ownerOfGrant(existing.value));
    return existing.value._id;
  }
);
