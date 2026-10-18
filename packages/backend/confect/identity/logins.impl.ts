import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import spec from "@repo/backend/confect/identity/logins.spec";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer, Number as Num, Struct } from "effect";

/** The largest page one request reads. */
const PAGE_LIMIT = 100;

/**
 * The school logins of the member's school, ordered by login name. Each row
 * reads the Person it belongs to once, by ID. The issue time is the creation
 * time of the login row, which `issue` writes once; a reissued card never
 * changes it, and no card code or password is read here.
 */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("identity.logins.list")(function* ({ paginationOpts }) {
    const { tenant } = yield* Member;
    const reader = yield* DatabaseReader;
    const logins = yield* reader
      .table("schoolLogins")
      .index("by_tenantId_and_name", (query) =>
        query.eq("tenantId", tenant._id)
      )
      .paginate(
        Struct.assign(paginationOpts, {
          numItems: Num.min(paginationOpts.numItems, PAGE_LIMIT),
        })
      )
      .pipe(Effect.orDie);
    const page = yield* Effect.forEach(
      logins.page,
      (login) =>
        reader
          .table("tenantPeople")
          .get(login.personId)
          .pipe(
            Effect.orDie,
            Effect.map((person) => ({
              issuedAt: login._creationTime,
              loginName: login.name,
              person: { id: person._id, name: person.name },
            }))
          ),
      { concurrency: "unbounded" }
    );
    return Struct.assign(logins, { page });
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  GroupImpl.finalize
);
