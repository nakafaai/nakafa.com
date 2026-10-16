import type { TenantPeopleDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import type { Account } from "@repo/backend/confect/tenancy/schema";
import { Effect, Struct } from "effect";

/** The account of a Person once a claim has bound it. */
export type ClaimedAccount = Extract<typeof Account.Type, { state: "claimed" }>;

/**
 * Binds one Person to the account that claims it. The caller decides that the
 * claim is allowed, accepts whatever invite or card it came from, and journals
 * `person.claimed`, all in the same transaction.
 */
export const bindPerson = Effect.fn("tenancy.claim.bind")(function* (
  person: TenantPeopleDoc,
  account: ClaimedAccount
) {
  yield* (yield* DatabaseWriter)
    .table("tenantPeople")
    .replace(
      person._id,
      Struct.assign(Struct.omit(person, ["_creationTime", "_id"]), { account })
    )
    .pipe(Effect.orDie);
});
