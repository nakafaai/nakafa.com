import { FunctionImpl, GroupImpl } from "@confect/server";
import type {
  SchoolLoginsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import { LoginNameRefused } from "@repo/backend/confect/identity/errors";
import {
  readLoginName,
  renameLoginName,
} from "@repo/backend/confect/identity/logins";
import spec from "@repo/backend/confect/identity/logins.spec";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Person } from "@repo/backend/confect/tenancy/access";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import {
  personAccess,
  personAuthority,
} from "@repo/backend/confect/tenancy/authority";
import { namedPeople } from "@repo/backend/confect/tenancy/named";
import {
  Array as Arr,
  Effect,
  Layer,
  Number as Num,
  Option,
  Result,
  Struct,
} from "effect";

/** The largest page one request reads. */
const PAGE_LIMIT = 100;

/**
 * The school logins of the member's school, ordered by login name, or those of the people
 * a search finds by name, so a search reaches every page. Each row reads the Person it
 * belongs to once, by ID. The issue time is the creation
 * time of the login row, which `issue` writes once; a reissued card never
 * changes it, and no card code or password is read here.
 */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("identity.logins.list")(function* ({ paginationOpts, search }) {
    const { tenant } = yield* Member;
    const reader = yield* DatabaseReader;
    const pageOptions = Struct.assign(paginationOpts, {
      numItems: Num.min(paginationOpts.numItems, PAGE_LIMIT),
    });
    const row = (login: SchoolLoginsDoc, person: TenantPeopleDoc) => ({
      issuedAt: login._creationTime,
      loginName: login.name,
      person: { id: person._id, name: person.name },
    });
    if (search !== undefined) {
      const people = yield* namedPeople(tenant._id, search, pageOptions);
      const page = yield* Effect.forEach(
        people.page,
        (person) =>
          reader
            .table("schoolLogins")
            .get("by_personId", person._id)
            .pipe(
              Effect.map((login) => Option.some(row(login, person))),
              Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
              Effect.orDie
            ),
        { concurrency: "unbounded" }
      );
      return Struct.assign(people, { page: Arr.getSomes(page) });
    }
    const logins = yield* reader
      .table("schoolLogins")
      .index("by_tenantId_and_name", (query) =>
        query.eq("tenantId", tenant._id)
      )
      .paginate(pageOptions)
      .pipe(Effect.orDie);
    const page = yield* Effect.forEach(
      logins.page,
      (login) =>
        reader
          .table("tenantPeople")
          .get(login.personId)
          .pipe(
            Effect.orDie,
            Effect.map((person) => row(login, person))
          ),
      { concurrency: "unbounded" }
    );
    return Struct.assign(logins, { page });
  })
);

/**
 * Renames the school login of one Person, which its card signs in with: the name reads as a person typed it, and no
 * other Person of the school may hold it. The student then signs in with the new name and the same password, and the
 * rename is recorded on the Person. A name the login already holds writes and records nothing.
 */
const rename = FunctionImpl.make(
  databaseSchema,
  spec,
  "rename",
  Effect.fn("identity.logins.renameLogin")(function* ({ loginName }) {
    const { person: actor } = yield* Member;
    const person = yield* Person;
    const name = readLoginName(loginName);
    if (Result.isFailure(name)) {
      return yield* new LoginNameRefused({ reason: name.failure });
    }
    if (yield* renameLoginName(person, name.success)) {
      yield* personAuthority.record(personActor(actor), person, {
        type: "login.renamed",
      });
    }
    return name.success;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(rename),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  Layer.provide(personAccess),
  GroupImpl.finalize
);
