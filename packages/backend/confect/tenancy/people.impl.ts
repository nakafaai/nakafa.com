import { FunctionImpl, GroupImpl } from "@confect/server";
import type { TenantPeopleDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import { revokeGrant } from "@repo/backend/confect/access/grant";
import { activeGrants } from "@repo/backend/confect/access/policy";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Person } from "@repo/backend/confect/tenancy/access";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import {
  cohortAuthority,
  personAccess,
  personAuthority,
} from "@repo/backend/confect/tenancy/authority";
import { replaceInviteState } from "@repo/backend/confect/tenancy/invite";
import { cohortMembers } from "@repo/backend/confect/tenancy/members";
import spec from "@repo/backend/confect/tenancy/people.spec";
import { PERSON_PLACEMENT_LIMIT } from "@repo/backend/confect/tenancy/placement";
import type { PersonStatus } from "@repo/backend/confect/tenancy/schema";
import { Array as Arr, Clock, Effect, Layer, Option, Struct } from "effect";

/** One Person as the school's list shows them. */
const view = (person: TenantPeopleDoc) => ({
  account: person.account.state,
  id: person._id,
  kind: person.kind,
  name: person.name,
  status: person.status,
});

/**
 * The Persons of one status in the member's school, a page at a time. With a
 * cohort, only the Persons placed in it, which its `cohort.view` decides first.
 */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("tenancy.people.list")(function* ({
    cohortId,
    paginationOpts,
    status,
  }) {
    if (cohortId !== undefined) {
      yield* cohortAuthority.authorize("cohort.view", cohortId);
      const placed = yield* cohortMembers(cohortId, paginationOpts);
      return Struct.assign(placed, {
        page: Arr.map(
          Arr.filter(placed.page, (person) => person.status === status),
          view
        ),
      });
    }
    const { tenant } = yield* Member;
    const page = yield* (yield* DatabaseReader)
      .table("tenantPeople")
      .index("by_tenantId_and_status", (query) =>
        query.eq("tenantId", tenant._id).eq("status", status)
      )
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    return Struct.assign(page, { page: Arr.map(page.page, view) });
  })
);

/** Creates an unclaimed active member Person. An account claims it later, through an invite. */
const create = FunctionImpl.make(
  databaseSchema,
  spec,
  "create",
  Effect.fn("tenancy.people.create")(function* ({ name }) {
    const { person: actor, tenant } = yield* Member;
    const reader = yield* DatabaseReader;
    const personId = yield* (yield* DatabaseWriter)
      .table("tenantPeople")
      .insert({
        account: { state: "unclaimed" },
        kind: "member",
        name,
        status: "active",
        tenantId: tenant._id,
      })
      .pipe(Effect.orDie);
    const person = yield* reader
      .table("tenantPeople")
      .get(personId)
      .pipe(Effect.orDie);
    yield* personAuthority.record(personActor(actor), person, {
      type: "person.created",
    });
    return view(person);
  })
);

/** Renames one Person. A name already held changes nothing. */
const rename = FunctionImpl.make(
  databaseSchema,
  spec,
  "rename",
  Effect.fn("tenancy.people.rename")(function* ({ name }) {
    const { person: actor } = yield* Member;
    const person = yield* Person;
    if (person.name === name) {
      return view(person);
    }
    yield* (yield* DatabaseWriter)
      .table("tenantPeople")
      .replace(
        person._id,
        Struct.assign(Struct.omit(person, ["_creationTime", "_id"]), { name })
      )
      .pipe(Effect.orDie);
    yield* personAuthority.record(personActor(actor), person, {
      type: "person.renamed",
    });
    return view(Struct.assign(person, { name }));
  })
);

/**
 * Removes one Person. Each standing grant ends through the access lane's revoke
 * path, every cohort placement ends, and the pending invite is revoked, all in
 * this transaction. The Person then refuses every write, and a claimed account
 * loses the school at once, because membership needs an active Person.
 */
const remove = FunctionImpl.make(
  databaseSchema,
  spec,
  "remove",
  Effect.fn("tenancy.people.remove")(function* () {
    const { person: actor } = yield* Member;
    const person = yield* Person;
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const by = personActor(actor);
    yield* Effect.forEach(
      yield* activeGrants(person._id),
      (grant) => revokeGrant(by, grant, person),
      { discard: true }
    );
    const placements = yield* reader
      .table("tenantCohortMembers")
      .index("by_personId", (query) => query.eq("personId", person._id))
      .take(PERSON_PLACEMENT_LIMIT)
      .pipe(Effect.orDie);
    yield* Effect.forEach(
      placements,
      (placement) =>
        writer
          .table("tenantCohortMembers")
          .delete(placement._id)
          .pipe(Effect.orDie),
      { discard: true }
    );
    const pending = yield* reader
      .table("tenantInvites")
      .index("by_personId_and_state_status", (query) =>
        query.eq("personId", person._id).eq("state.status", "pending")
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(pending)) {
      yield* replaceInviteState(pending.value, {
        at: yield* Clock.currentTimeMillis,
        status: "revoked",
      });
      yield* personAuthority.record(by, person, {
        invite: pending.value._id,
        type: "invite.revoked",
      });
    }
    const status: typeof PersonStatus.Type = "removed";
    yield* writer
      .table("tenantPeople")
      .replace(
        person._id,
        Struct.assign(Struct.omit(person, ["_creationTime", "_id"]), { status })
      )
      .pipe(Effect.orDie);
    yield* personAuthority.record(by, person, { type: "person.removed" });
    return view(Struct.assign(person, { status }));
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(create),
  Layer.provide(rename),
  Layer.provide(remove),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  Layer.provide(personAccess),
  GroupImpl.finalize
);
