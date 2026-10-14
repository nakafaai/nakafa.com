import type { TenantPeopleDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import { personAuthority } from "@repo/backend/confect/tenancy/authority";
import { replaceInviteState } from "@repo/backend/confect/tenancy/invite";
import type {
  Account,
  PersonStatus,
} from "@repo/backend/confect/tenancy/schema";
import { Effect, Option, Struct } from "effect";

/** A Person whose account is released holds no account until a new invite claims it. */
const unclaimed: typeof Account.Type = { state: "unclaimed" };

/**
 * Releases the account a Person holds and sets the Person's status, as `actor`.
 * The Person becomes unclaimed, and its accepted invite is revoked, so the invite
 * names no account and can never be claimed. The address of that account can be
 * invited again. The journal records the release only when the Person held an
 * account, because an unclaimed Person has none to release. Returns the Person as
 * stored.
 */
export const releaseAccount = Effect.fn("tenancy.release.account")(function* (
  person: TenantPeopleDoc,
  status: typeof PersonStatus.Type,
  at: number,
  actor: typeof TenantActor.Type
) {
  yield* (yield* DatabaseWriter)
    .table("tenantPeople")
    .replace(
      person._id,
      Struct.assign(Struct.omit(person, ["_creationTime", "_id"]), {
        account: unclaimed,
        status,
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
  if (person.account.state === "claimed") {
    yield* personAuthority.record(actor, person, { type: "person.released" });
  }
  return Struct.assign(person, { account: unclaimed, status });
});
