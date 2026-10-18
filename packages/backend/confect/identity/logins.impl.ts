import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import { readLoginName } from "@repo/backend/confect/identity/logins";
import spec from "@repo/backend/confect/identity/logins.spec";
import type { LoginUsername } from "@repo/backend/confect/identity/schema";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Effect, Layer, Number as Num, Option, Result, Struct } from "effect";

/** The largest page one request reads. */
const PAGE_LIMIT = 100;

/** A school login that has no username to sign in with, for every reason it has none. */
const missing = (): typeof LoginUsername.Type => ({ outcome: "missing" });

/** The Better Auth username of a school login, which its password sign-in checks. */
const found = (username: string): typeof LoginUsername.Type => ({
  outcome: "found",
  username,
});

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

/**
 * The Better Auth username of one school login on its school's host, for the password
 * sign-in there (ADR 0009). A name the school cannot hold, an unknown school or name, a
 * Person who is not active, and an account that nobody has claimed all read as `missing`,
 * so the answer never tells a visitor which of them held. Every read is indexed.
 */
const usernameOf = FunctionImpl.make(
  databaseSchema,
  spec,
  "usernameOf",
  Effect.fn("identity.logins.usernameOf")(function* ({ loginName, slug }) {
    const name = readLoginName(loginName);
    if (Result.isFailure(name)) {
      return missing();
    }
    const reader = yield* DatabaseReader;
    const tenant = yield* reader
      .table("tenants")
      .get("by_slug", slug)
      .pipe(
        Effect.asSome,
        Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
        Effect.orDie
      );
    if (Option.isNone(tenant)) {
      return missing();
    }
    const login = yield* reader
      .table("schoolLogins")
      .index("by_tenantId_and_name", (query) =>
        query.eq("tenantId", tenant.value._id).eq("name", name.success)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isNone(login)) {
      return missing();
    }
    const person = yield* reader
      .table("tenantPeople")
      .get(login.value.personId)
      .pipe(Effect.orDie);
    if (person.status !== "active" || person.account.state !== "claimed") {
      return missing();
    }
    const user = yield* reader
      .table("users")
      .get(person.account.userId)
      .pipe(Effect.orDie);
    if (user.username === undefined) {
      return missing();
    }
    return found(user.username);
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(usernameOf),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  GroupImpl.finalize
);
