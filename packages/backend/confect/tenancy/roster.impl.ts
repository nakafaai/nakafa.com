import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import type {
  TenantGrantsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  grantAuthority,
  tenantAccess,
} from "@repo/backend/confect/access/authority";
import {
  assignRole,
  authorizeOwnerRole,
} from "@repo/backend/confect/access/grant";
import { activeGrants } from "@repo/backend/confect/access/policy";
import { OwnerRole } from "@repo/backend/confect/access/schema";
import { cardOf } from "@repo/backend/confect/identity/card";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import {
  personAuthority,
  tenantAuthority,
} from "@repo/backend/confect/tenancy/authority";
import { createPerson } from "@repo/backend/confect/tenancy/create";
import {
  AddressInvited,
  AddressMember,
  InviteDomainRefused,
} from "@repo/backend/confect/tenancy/errors";
import {
  addressInvited,
  addressJoined,
  earlierInvitee,
  expireInvite,
  pendingInviteOf,
  writeInvite,
} from "@repo/backend/confect/tenancy/invite";
import { admitsAddress } from "@repo/backend/confect/tenancy/policy";
import { renamePerson } from "@repo/backend/confect/tenancy/rename";
import { memberStatusOf } from "@repo/backend/confect/tenancy/roster";
import spec from "@repo/backend/confect/tenancy/roster.spec";
import type { Email, PersonName } from "@repo/backend/confect/tenancy/schema";
import {
  Array as Arr,
  Clock,
  Effect,
  Layer,
  Option,
  Schema,
  Struct,
} from "effect";

/**
 * Whether an unclaimed Person waits on a pending invite whose term has not ended.
 * The Person's pending invite is one indexed read.
 */
const waitingOnInvite = Effect.fn("tenancy.roster.waitingOnInvite")(function* (
  person: TenantPeopleDoc
) {
  const pending = yield* pendingInviteOf(person._id);
  const now = yield* Clock.currentTimeMillis;
  return Option.exists(pending, (invite) => invite.expiresAt > now);
});

/**
 * Whether an unclaimed Person holds a login card that still works: one not yet
 * redeemed and still within its term. A card past its term no longer counts.
 */
const holdsLiveCard = Effect.fn("tenancy.roster.liveCard")(function* (
  person: TenantPeopleDoc
) {
  const card = yield* cardOf(person._id);
  const now = yield* Clock.currentTimeMillis;
  return Option.exists(
    card,
    (stored) => stored.expiresAt > now && stored.redeemedAt === undefined
  );
});

/**
 * One row of the members list: the Person, the roles its active grants give, and its
 * status. Only an unclaimed Person can wait on an invite or hold a card, so a claimed
 * Person costs one grant read.
 */
const memberRow = Effect.fn("tenancy.roster.member")(function* (
  person: TenantPeopleDoc,
  caller: GenericId.GenericId<"tenantPeople">,
  managesOwners: boolean
) {
  const claimed = person.account.state === "claimed";
  const invited = claimed ? false : yield* waitingOnInvite(person);
  const carded = claimed ? false : yield* holdsLiveCard(person);
  const grants = yield* activeGrants(person._id);
  return {
    id: person._id,
    name: person.name,
    removable: yield* removableBy(person, grants, caller, managesOwners),
    roles: Arr.dedupe(Arr.map(grants, (grant) => grant.role.key)),
    status: memberStatusOf({ carded, claimed, invited }),
  };
});

/**
 * Whether the caller may remove the Person, decided as `people.remove` decides it: the caller
 * manages the Person and may revoke each of its grants, and an Owner or Admin grant also needs
 * the Owner rule. Nobody removes themselves here, because the removal would end the remover's
 * own school. The last-Owner rule needs no read: an Owner who removes someone stays, and only an
 * Owner may end an Owner's grant.
 */
const removableBy = Effect.fn("tenancy.roster.removable")(function* (
  person: TenantPeopleDoc,
  grants: readonly TenantGrantsDoc[],
  caller: GenericId.GenericId<"tenantPeople">,
  managesOwners: boolean
) {
  if (person._id === caller) {
    return false;
  }
  if (!Arr.contains(yield* personAuthority.allowed(person), "person.manage")) {
    return false;
  }
  const revocable = yield* Effect.forEach(grants, (grant) =>
    Effect.map(
      grantAuthority.allowed(grant),
      (can) =>
        Arr.contains(can, "grant.revoke") &&
        (managesOwners || !Schema.is(OwnerRole)(grant.role.key))
    )
  );
  return Arr.every(revocable, (allowed) => allowed);
});

/**
 * The active members of the school, a page at a time, each with its roles, its status, and
 * whether the caller may remove it. Operator Persons are visits, not members, so the page
 * leaves them out.
 */
const members = FunctionImpl.make(
  databaseSchema,
  spec,
  "members",
  Effect.fn("tenancy.roster.members")(function* ({ paginationOpts }) {
    const { person: caller, tenant } = yield* Member;
    const managesOwners = Arr.contains(
      yield* tenantAuthority.allowed(tenant),
      "owner.manage"
    );
    const page = yield* (yield* DatabaseReader)
      .table("tenantPeople")
      .index("by_tenantId_and_status", (query) =>
        query.eq("tenantId", tenant._id).eq("status", "active")
      )
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    const rows = yield* Effect.forEach(
      Arr.filter(page.page, (person) => person.kind === "member"),
      (person) => memberRow(person, caller._id, managesOwners),
      { concurrency: "unbounded" }
    );
    return Struct.assign(page, { page: rows });
  })
);

/**
 * The Person that a new invite of this school names. The Person of an address's
 * earlier invite takes the new one, so the address keeps one row in the members list:
 * a pending invite whose term has ended is expired first, and the Person takes the
 * name typed now. Any other address gets a new Person.
 */
const inviteePerson = Effect.fn("tenancy.roster.invitee")(function* (
  by: typeof TenantActor.Type,
  tenantId: GenericId.GenericId<"tenants">,
  email: typeof Email.Type,
  name: typeof PersonName.Type
) {
  const earlier = yield* earlierInvitee(tenantId, email);
  if (Option.isNone(earlier)) {
    return yield* createPerson(by, tenantId, name);
  }
  const pending = yield* pendingInviteOf(earlier.value._id);
  if (Option.isSome(pending)) {
    yield* expireInvite(pending.value, earlier.value);
  }
  return yield* renamePerson(by, earlier.value, name);
});

/**
 * Adds a teacher or an Admin in one transaction: the Person, the role over the whole
 * school, and the invite that names the address. An address the school does not admit
 * is refused, and so is one that already holds a pending invite here, so a retried
 * request adds nobody twice. An address whose earlier invite here has ended gets the
 * same Person again. The role follows the Owner rule of `authorizeOwnerRole`.
 */
const invite = FunctionImpl.make(
  databaseSchema,
  spec,
  "invite",
  Effect.fn("tenancy.roster.invite")(function* ({ email, locale, name, role }) {
    const { person: actor, tenant } = yield* Member;
    if (!admitsAddress(tenant.policies, email)) {
      return yield* new InviteDomainRefused();
    }
    if (yield* addressInvited(tenant._id, email)) {
      return yield* new AddressInvited();
    }
    if (yield* addressJoined(tenant._id, email)) {
      return yield* new AddressMember();
    }
    yield* tenantAuthority.check("grant.manage", tenant);
    yield* authorizeOwnerRole(role);
    const by = personActor(actor);
    const person = yield* inviteePerson(by, tenant._id, email, name);
    yield* personAuthority.check("person.invite", person);
    yield* assignRole(by, person, role, { kind: "tenant" });
    const written = yield* writeInvite(by, person, email, locale);
    return { invite: written._id, person: person._id };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(members),
  Layer.provide(invite),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  GroupImpl.finalize
);
