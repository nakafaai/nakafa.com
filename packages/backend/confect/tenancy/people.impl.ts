import { FunctionImpl, GroupImpl } from "@confect/server";
import type {
  TenantCohortMembersDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
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
  personAccess,
  personAuthority,
} from "@repo/backend/confect/tenancy/authority";
import { replaceInviteState } from "@repo/backend/confect/tenancy/invite";
import spec from "@repo/backend/confect/tenancy/people.spec";
import { PERSON_PLACEMENT_LIMIT } from "@repo/backend/confect/tenancy/placement";
import { releaseAccount } from "@repo/backend/confect/tenancy/release";
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
 * The Persons of one status in the member's school, a page at a time, read on
 * the status index. A cohort's members are listed by `cohorts:members`: the
 * placements of a cohort are not indexed by status, and a page filtered after
 * it is read would come back short.
 */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("tenancy.people.list")(function* ({ paginationOpts, status }) {
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
 * Whether a placement is history that removal keeps: its period or its cohort is
 * archived, so it stays as the record of where the Person was placed.
 */
const isHistory = Effect.fn("tenancy.people.history")(function* (
  placement: TenantCohortMembersDoc
) {
  const reader = yield* DatabaseReader;
  const term = yield* reader
    .table("tenantPeriods")
    .get(placement.periodId)
    .pipe(Effect.orDie);
  const cohort = yield* reader
    .table("tenantCohorts")
    .get(placement.cohortId)
    .pipe(Effect.orDie);
  return term.status === "archived" || cohort.status === "archived";
});

/**
 * Removes one Person. Each standing grant ends through the access lane's revoke
 * path, and each cohort placement ends unless it is history. The pending invite
 * is revoked, and the account is released as account deletion releases it, so
 * the account can be invited again. The Person then refuses every write, and a
 * claimed account loses the school at once, because membership needs an active
 * Person.
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
    const at = yield* Clock.currentTimeMillis;
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
    const ended = yield* Effect.filter(placements, (placement) =>
      isHistory(placement).pipe(Effect.map((history) => !history))
    );
    yield* Effect.forEach(
      ended,
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
      yield* replaceInviteState(pending.value, { at, status: "revoked" });
      yield* personAuthority.record(by, person, {
        invite: pending.value._id,
        type: "invite.revoked",
      });
    }
    const removed = yield* releaseAccount(person, "removed", at, by);
    yield* personAuthority.record(by, person, { type: "person.removed" });
    return view(removed);
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
