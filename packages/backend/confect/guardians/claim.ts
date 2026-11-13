import {
  DatabaseReader,
} from "@repo/backend/confect/_generated/services";
import { isLive } from "@repo/backend/confect/guardians/link";
import { isLoginAddress } from "@repo/backend/confect/identity/address";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { personAuthority } from "@repo/backend/confect/tenancy/authority";
import { bindPerson } from "@repo/backend/confect/tenancy/claim";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Clock, Effect, Option } from "effect";

/** The most links one address holds across schools that one claim reads. */
const ADDRESS_LINK_LIMIT = 50;

/**
 * Binds every guardian Person that a live link of the address names, and that
 * no account holds yet, to the account whose Google-verified address it is
 * (ADR 0034). The claim is journaled as `person.claimed` with the method
 * `address`. Signing in is not consent for a child (K2): the consent still waits
 * for the NISN check or for staff.
 */
export const claimGuardianPersons = Effect.fn("guardians.claim.address")(
  function* (userId: Id<"users">, email: string) {
    if (isLoginAddress(email)) {
      return;
    }
    const reader = yield* DatabaseReader;
    const now = yield* Clock.currentTimeMillis;
    const links = yield* reader
      .table("guardianLinks")
      .index("by_email", (query) => query.eq("email", email))
      .take(ADDRESS_LINK_LIMIT)
      .pipe(Effect.orDie);
    const guardianIds = Arr.dedupe(
      Arr.map(
        Arr.filter(links, (link) => isLive(link, now)),
        (link) => link.guardianPersonId
      )
    );
    yield* Effect.forEach(
      guardianIds,
      (guardianId) =>
        Effect.gen(function* () {
          const guardian = yield* reader
            .table("tenantPeople")
            .get(guardianId)
            .pipe(Effect.orDie);
          if (
            guardian.status !== "active" ||
            guardian.account.state === "claimed"
          ) {
            return;
          }
          yield* bindPerson(guardian, {
            claimedAt: now,
            method: "address",
            state: "claimed",
            userId,
          });
          yield* personAuthority.record(personActor(guardian), guardian, {
            method: "address",
            type: "person.claimed",
          });
        }),
      { discard: true }
    );
  }
);

/**
 * Claims the guardian Persons of an address for the live account that already
 * holds it, so a guardian who signed in before the school linked them gets the
 * Person at once, without signing in again.
 */
export const claimForAddress = Effect.fn("guardians.claim.forAddress")(
  function* (email: string) {
    const account = yield* (yield* DatabaseReader)
      .table("users")
      .index("by_email", (query) => query.eq("email", email))
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(account) && account.value.deletedAt === undefined) {
      yield* claimGuardianPersons(account.value._id, email);
    }
  }
);
