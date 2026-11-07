import type { GenericId } from "@confect/core";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { GrantRejected } from "@repo/backend/confect/access/errors";
import { runningSchoolGrants } from "@repo/backend/confect/billing/school";
import { schoolPlans } from "@repo/backend/confect/billing/tier";
import { Array as Arr, Clock, Effect, HashSet, Result } from "effect";

/**
 * The most active grants one count reads. A person holds one grant per role and
 * unit, so a Max school with its added accounts holds a few thousand; a school
 * past this bound signs an Enterprise contract.
 */
const GRANT_SCAN = 8192;

/**
 * The accounts of one school: its Persons who hold an active grant of any role,
 * each counted once however many roles and units they hold. An integration is a
 * client of the school's API, not an account.
 */
export const countAccounts = Effect.fn("billing.seats.countAccounts")(
  function* (tenantId: GenericId.GenericId<"tenants">) {
    const grants = yield* (yield* DatabaseReader)
      .table("tenantGrants")
      .index("by_tenantId_and_status", (query) =>
        query.eq("tenantId", tenantId).eq("status", "active")
      )
      .take(GRANT_SCAN)
      .pipe(Effect.orDie);
    return HashSet.size(
      HashSet.fromIterable(
        Arr.filterMap(grants, (grant) =>
          grant.role.key === "integration"
            ? Result.failVoid
            : Result.succeed(grant.personId)
        )
      )
    );
  }
);

/**
 * The accounts a school may hold at `now`: what its running School grants pay
 * for, or the trial's accounts while none runs.
 */
export const accountLimit = Effect.fn("billing.seats.accountLimit")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  now: number
) {
  const grants = yield* runningSchoolGrants(tenantId, now);
  return Arr.isReadonlyArrayNonEmpty(grants)
    ? Arr.reduce(grants, 0, (total, grant) => total + grant.seats)
    : schoolPlans.trial.accounts;
});

/**
 * Refuses one more account once a school holds as many accounts as its plan pays
 * for. The caller asks only for a Person who holds no active grant yet, since a
 * Person who already holds a role takes no second account.
 */
export const ensureAccountSeat = Effect.fn("billing.seats.ensure")(function* (
  tenantId: GenericId.GenericId<"tenants">
) {
  const limit = yield* accountLimit(tenantId, yield* Clock.currentTimeMillis);
  if ((yield* countAccounts(tenantId)) < limit) {
    return;
  }
  return yield* new GrantRejected({
    code: "SEAT_LIMIT",
    message: `This school holds the ${limit} accounts its plan pays for.`,
  });
});
