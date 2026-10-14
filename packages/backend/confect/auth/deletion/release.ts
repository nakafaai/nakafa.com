import type {
  Docs,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE } from "@repo/backend/confect/auth/deletion/constants";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { personAuthority } from "@repo/backend/confect/tenancy/authority";
import { replaceInviteState } from "@repo/backend/confect/tenancy/invite";
import type { Account } from "@repo/backend/confect/tenancy/schema";
import { Array as Arr, Effect, Option, Struct } from "effect";

/** A Person whose account was deleted holds no account until a new invite claims it. */
const unclaimed: typeof Account.Type = { state: "unclaimed" };

/**
 * Releases one Person of a deleted account: the Person is unclaimed again, and
 * its accepted invite is revoked, so it names no account and can never be
 * claimed. The journal records the release. The Person joins the school again
 * only through a new invite.
 */
const release = Effect.fn("auth.deletion.release")(function* (
  person: TenantPeopleDoc,
  at: number
) {
  yield* (yield* DatabaseWriter)
    .table("tenantPeople")
    .replace(
      person._id,
      Struct.assign(Struct.omit(person, ["_creationTime", "_id"]), {
        account: unclaimed,
      })
    )
    .pipe(Effect.orDie);
  const accepted = yield* (yield* DatabaseReader)
    .table("tenantInvites")
    .index("by_personId_and_state_status", (query) =>
      query.eq("personId", person._id).eq("state.status", "accepted")
    )
    .first()
    .pipe(Effect.orDie);
  if (Option.isSome(accepted)) {
    yield* replaceInviteState(accepted.value, { at, status: "revoked" });
  }
  yield* personAuthority.record(systemActor, person, {
    type: "person.released",
  });
});

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
    (person) => release(person, at),
    { discard: true }
  );
  return people.length > ACCOUNT_DELETION_TRANSACTION_BATCH_SIZE;
});
