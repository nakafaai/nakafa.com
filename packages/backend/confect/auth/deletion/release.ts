import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE } from "@repo/backend/confect/auth/deletion/constants";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { releaseAccount } from "@repo/backend/confect/tenancy/release";
import { Array as Arr, Effect } from "effect";

/**
 * Releases the Persons of a deleted account, one bounded batch in each
 * transaction, so no number of schools is assumed. Returns whether more of them
 * remain, and the caller then continues in a later transaction.
 */
export const releaseTenantPeople = Effect.fn(
  "auth.deletion.releaseTenantPeople"
)(function* (user: Docs["users"], at: number) {
  const people = yield* (yield* DatabaseReader)
    .table("tenantPeople")
    .index("by_account_userId_and_kind_and_status", (query) =>
      query.eq("account.userId", user._id)
    )
    .take(ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE + 1)
    .pipe(Effect.orDie);
  yield* Effect.forEach(
    Arr.take(people, ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE),
    (person) => releaseAccount(person, person.status, at, systemActor),
    { discard: true }
  );
  return people.length > ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE;
});
