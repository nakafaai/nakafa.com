import { FunctionImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { personAuthority } from "@repo/backend/confect/tenancy/authority";
import {
  InviteDomainRefused,
  PersonClaimed,
} from "@repo/backend/confect/tenancy/errors";
import {
  endInvite,
  pendingOrRefused,
  writeInvite,
} from "@repo/backend/confect/tenancy/invite";
import spec from "@repo/backend/confect/tenancy/invites.spec";
import {
  loadInvite,
  viewOf,
} from "@repo/backend/confect/tenancy/invites.table";
import { admitsAddress } from "@repo/backend/confect/tenancy/policy";
import { Effect } from "effect";

/**
 * Corrects the address of a pending invite: the mistyped invite ends and a new one goes to the
 * right address in one transaction, under the school's domain rule, with a fresh term, because the
 * old address may hold the code and the new one has not had its term yet. The same address changes
 * nothing.
 */
export const readdress = FunctionImpl.make(
  databaseSchema,
  spec,
  "readdress",
  Effect.fn("tenancy.invites.readdress")(function* ({
    email,
    inviteId,
    locale,
  }) {
    const { person: actor, tenant } = yield* Member;
    const stored = yield* loadInvite(inviteId);
    const person = yield* personAuthority.authorize(
      "person.invite",
      stored.personId
    );
    if (person.account.state === "claimed") {
      return yield* new PersonClaimed();
    }
    if (!admitsAddress(tenant.policies, email)) {
      return yield* new InviteDomainRefused();
    }
    yield* pendingOrRefused(stored);
    if (stored.channel.email === email) {
      return yield* viewOf(stored, person);
    }
    yield* endInvite(personActor(actor), stored, person);
    return yield* viewOf(
      yield* writeInvite(personActor(actor), person, email, locale),
      person
    );
  })
);
