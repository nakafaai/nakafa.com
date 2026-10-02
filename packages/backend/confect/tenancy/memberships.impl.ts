import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { requireAuth } from "@repo/backend/confect/auth/session";
import session from "@repo/backend/confect/middleware/session.impl";
import spec from "@repo/backend/confect/tenancy/memberships.spec";
import { Effect, Layer } from "effect";

/** The caller's active member Persons; operator Persons never appear here. */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("tenancy.memberships.list")(function* ({ paginationOpts }) {
    const { appUser } = yield* requireAuth();
    const reader = yield* DatabaseReader;
    const people = yield* reader
      .table("tenantPeople")
      .index("by_account_userId_and_kind_and_status", (query) =>
        query
          .eq("account.userId", appUser._id)
          .eq("kind", "member")
          .eq("status", "active")
      )
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    const page = yield* Effect.forEach(people.page, (person) =>
      reader
        .table("tenants")
        .get(person.tenantId)
        .pipe(
          Effect.orDie,
          Effect.map((tenant) => ({
            person: { id: person._id, name: person.name },
            tenant: {
              kind: tenant.kind,
              name: tenant.name,
              slug: tenant.slug,
              status: tenant.status,
            },
          }))
        )
    );
    return { ...people, page };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(session),
  GroupImpl.finalize
);
