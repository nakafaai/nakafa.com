import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { requireAcceptanceSeed } from "@repo/backend/confect/acceptance/seed";
import { assignRole } from "@repo/backend/confect/access/grant";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { personAuthority } from "@repo/backend/confect/tenancy/authority";
import { TenantNotFound } from "@repo/backend/confect/tenancy/errors";
import { writeInvite } from "@repo/backend/confect/tenancy/invite";
import spec from "@repo/backend/confect/tenancy/seed.spec";
import { Effect, Layer, Option } from "effect";

/**
 * Seeds one Teacher of an open school for an acceptance run, as `open` seeds its
 * Owner: an unclaimed Person with an invite to the address, and a teacher grant
 * over the whole school. The account that signs in with the address claims the
 * invite. The journal names the system, as it does for `open`.
 */
const teacher = FunctionImpl.make(
  databaseSchema,
  spec,
  "teacher",
  Effect.fn("tenancy.seed.teacher")(function* ({ email, locale, name, slug }) {
    yield* requireAcceptanceSeed();
    const reader = yield* DatabaseReader;
    const tenant = yield* reader
      .table("tenants")
      .index("by_slug", (query) => query.eq("slug", slug))
      .first()
      .pipe(Effect.orDie);
    if (Option.isNone(tenant)) {
      return yield* new TenantNotFound();
    }
    const personId = yield* (yield* DatabaseWriter)
      .table("tenantPeople")
      .insert({
        account: { state: "unclaimed" },
        kind: "member",
        name,
        status: "active",
        tenantId: tenant.value._id,
      })
      .pipe(Effect.orDie);
    const person = yield* reader
      .table("tenantPeople")
      .get(personId)
      .pipe(Effect.orDie);
    yield* personAuthority.record(systemActor, person, {
      type: "person.created",
    });
    const invite = yield* writeInvite(systemActor, person, email, locale);
    yield* assignRole(systemActor, person, "teacher", {
      kind: "tenant",
    }).pipe(Effect.orDie);
    return { invite: invite._id, person: personId };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(teacher),
  GroupImpl.finalize
);
