import { FunctionImpl, GroupImpl } from "@confect/server";
import type { TenantPeopleDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import {
  assignRole,
  authorizeOwnerRole,
} from "@repo/backend/confect/access/grant";
import { activeGrants } from "@repo/backend/confect/access/policy";
import { cardOf } from "@repo/backend/confect/identity/card";
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
  InviteDomainRefused,
} from "@repo/backend/confect/tenancy/errors";
import {
  addressInvited,
  writeInvite,
} from "@repo/backend/confect/tenancy/invite";
import { admitsAddress } from "@repo/backend/confect/tenancy/policy";
import { memberStatusOf } from "@repo/backend/confect/tenancy/roster";
import spec from "@repo/backend/confect/tenancy/roster.spec";
import { Array as Arr, Clock, Effect, Layer, Option, Struct } from "effect";

/**
 * Whether an unclaimed Person waits on a pending invite whose term has not ended.
 * The Person's pending invite is one indexed read.
 */
const waitingOnInvite = Effect.fn("tenancy.roster.waitingOnInvite")(function* (
  person: TenantPeopleDoc
) {
  const pending = yield* (yield* DatabaseReader)
    .table("tenantInvites")
    .index("by_personId_and_state_status", (query) =>
      query.eq("personId", person._id).eq("state.status", "pending")
    )
    .first()
    .pipe(Effect.orDie);
  const now = yield* Clock.currentTimeMillis;
  return Option.exists(pending, (invite) => invite.expiresAt > now);
});

/**
 * One row of the members list: the Person, the roles its active grants give, and its
 * status. Only an unclaimed Person can wait on an invite or hold a card, so a claimed
 * Person costs one grant read.
 */
const memberRow = Effect.fn("tenancy.roster.member")(function* (
  person: TenantPeopleDoc
) {
  const claimed = person.account.state === "claimed";
  const invited = claimed ? false : yield* waitingOnInvite(person);
  const carded = claimed ? false : Option.isSome(yield* cardOf(person._id));
  const grants = yield* activeGrants(person._id);
  return {
    id: person._id,
    name: person.name,
    roles: Arr.dedupe(Arr.map(grants, (grant) => grant.role.key)),
    status: memberStatusOf({ carded, claimed, invited }),
  };
});

/**
 * The active members of the school, a page at a time, each with its roles and its
 * status. Operator Persons are visits, not members, so the page leaves them out.
 */
const members = FunctionImpl.make(
  databaseSchema,
  spec,
  "members",
  Effect.fn("tenancy.roster.members")(function* ({ paginationOpts }) {
    const { tenant } = yield* Member;
    const page = yield* (yield* DatabaseReader)
      .table("tenantPeople")
      .index("by_tenantId_and_status", (query) =>
        query.eq("tenantId", tenant._id).eq("status", "active")
      )
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    const rows = yield* Effect.forEach(
      Arr.filter(page.page, (person) => person.kind === "member"),
      (person) => memberRow(person),
      { concurrency: "unbounded" }
    );
    return Struct.assign(page, { page: rows });
  })
);

/**
 * Adds a teacher or an Admin in one transaction: the Person, the role over the whole
 * school, and the invite that names the address. An address the school does not admit
 * is refused, and so is one that already holds a pending invite here, so a retried
 * request adds nobody twice. The role follows the Owner rule of `authorizeOwnerRole`.
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
    yield* tenantAuthority.check("grant.manage", tenant);
    yield* authorizeOwnerRole(role);
    const by = personActor(actor);
    const person = yield* createPerson(by, tenant._id, name);
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
