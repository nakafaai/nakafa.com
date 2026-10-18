import { FunctionImpl, GroupImpl } from "@confect/server";
import type { TenantPeopleDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import { revokeGrant } from "@repo/backend/confect/access/grant";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Person } from "@repo/backend/confect/tenancy/access";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import {
  personAccess,
  personAuthority,
} from "@repo/backend/confect/tenancy/authority";
import { createPerson } from "@repo/backend/confect/tenancy/create";
import spec from "@repo/backend/confect/tenancy/people.spec";
import { removePerson } from "@repo/backend/confect/tenancy/remove";
import { Array as Arr, Effect, Layer, Struct } from "effect";

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
 * the status index. With `account: "unclaimed"` the page is read on the index of
 * the status and the account state, so the Persons who hold no account are never
 * cut off by the Persons who hold one. A cohort's members are listed by
 * `cohorts:members`: the placements of a cohort are not indexed by status, and a
 * page filtered after it is read would come back short.
 */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("tenancy.people.list")(function* ({
    account,
    paginationOpts,
    status,
  }) {
    const { tenant } = yield* Member;
    const people = (yield* DatabaseReader).table("tenantPeople");
    const page = yield* (
      account === undefined
        ? people.index("by_tenantId_and_status", (query) =>
            query.eq("tenantId", tenant._id).eq("status", status)
          )
        : people.index("by_tenantId_and_status_and_account_state", (query) =>
            query
              .eq("tenantId", tenant._id)
              .eq("status", status)
              .eq("account.state", account)
          )
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
    return view(yield* createPerson(personActor(actor), tenant._id, name));
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
 * path, and the rest of the removal is shared with the operator's replacement
 * of an Owner. The Person then refuses every write, and a claimed account loses
 * the school at once, because membership needs an active Person.
 */
const remove = FunctionImpl.make(
  databaseSchema,
  spec,
  "remove",
  Effect.fn("tenancy.people.remove")(function* () {
    const { person: actor } = yield* Member;
    const person = yield* Person;
    const by = personActor(actor);
    return view(
      yield* removePerson(by, person, (grant) => revokeGrant(by, grant, person))
    );
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
